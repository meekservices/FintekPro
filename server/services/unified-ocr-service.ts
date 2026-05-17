/**
 * Unified OCR Service — Central document text extraction
 *
 * Providers:
 *   1. Gemini Vision (gemini-2.5-flash) — general-purpose OCR for scanned PDFs,
 *      images (JPG/PNG/WEBP/HEIC), and any document where pdf-parse returns empty.
 *   2. Sandbox.co.in — ITR-specific structured extraction (Form 16, Form 26AS).
 *
 * Key capabilities:
 *   - extractTextFromScannedPDF(buffer)   — PDF with no embedded text layer
 *   - extractTextFromImage(buffer, mime)  — Standalone image OCR
 *   - extractText(buffer, mime, hint?)    — Universal dispatcher
 *   - getStatus()                         — Health / provider availability
 */

import { GoogleGenAI } from '@google/genai';

// ============================================
// TYPES
// ============================================

export type DocumentMimeType =
  | 'application/pdf'
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/heic'
  | 'image/heif';

export type DocumentHint =
  | 'financial_statement'  // CAS, broker statement, portfolio
  | 'tax_document'         // Form 16, 26AS, ITR
  | 'kyc_document'         // PAN, Aadhaar, passport
  | 'bank_statement'       // Bank transactions
  | 'invoice'              // Invoice / receipt
  | 'general';             // Any other document

export interface OCRResult {
  success: boolean;
  text: string;
  provider: 'gemini' | 'sandbox' | 'none';
  confidence: 'high' | 'medium' | 'low' | 'unknown';
  pageCount?: number;
  processingTimeMs: number;
  error?: string;
  usedFallback: boolean;
}

export interface OCRStatus {
  available: boolean;
  providers: {
    gemini: { available: boolean; model: string };
    sandbox: { available: boolean; endpoints: string[] };
  };
  capabilities: string[];
}

// ============================================
// CONSTANTS
// ============================================

const GEMINI_MODEL = 'gemini-2.5-flash';
const MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024;   // 20 MB — Gemini inline limit
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;  // 5 MB

// Prompt templates per document hint
const PROMPT_FOR_HINT: Record<DocumentHint, string> = {
  financial_statement: `You are a financial document OCR engine. Extract ALL text from this document with maximum fidelity.
Preserve:
- All numbers exactly (NAV, units, amounts, percentages)
- ISIN codes and folio numbers
- Fund/scheme names
- Dates in their original format
- Table structure using whitespace alignment
- Investor name, PAN, email, mobile
Output ONLY the extracted text — no commentary, no markdown, no explanations.`,

  tax_document: `You are a tax document OCR engine. Extract ALL text from this document precisely.
Preserve:
- All monetary amounts and TDS figures exactly
- PAN numbers, TAN numbers, assessment year
- Employer/deductor names and addresses
- Section references (80C, 10, etc.)
- Tables with proper alignment
Output ONLY the extracted text — no commentary.`,

  kyc_document: `You are a KYC document OCR engine. Extract ALL text from this identity document.
Preserve:
- Name exactly as printed
- ID numbers (PAN, Aadhaar, passport number) exactly
- Date of birth and address
- All text in any language present (transliterate to English if needed)
Output ONLY the extracted text — no commentary.`,

  bank_statement: `You are a bank statement OCR engine. Extract ALL text from this document.
Preserve:
- Account number, IFSC, branch details
- All transaction rows with dates, descriptions, debit/credit/balance amounts
- Opening and closing balance
- Table structure using whitespace alignment
Output ONLY the extracted text — no commentary.`,

  invoice: `You are an invoice OCR engine. Extract ALL text from this document.
Preserve:
- Invoice number, date, due date
- Vendor and customer details
- Line items with quantities, rates, amounts
- GST/tax breakdowns, totals
Output ONLY the extracted text — no commentary.`,

  general: `You are a document OCR engine. Extract ALL text from this document with maximum fidelity.
Preserve the original layout as closely as possible using whitespace.
Output ONLY the extracted text — no commentary, no explanations.`,
};

// ============================================
// UNIFIED OCR SERVICE
// ============================================

class UnifiedOCRService {
  private static instance: UnifiedOCRService;
  private ai: GoogleGenAI;
  private geminiAvailable: boolean;

  private constructor() {
    const apiKey = process.env.GEMINI_API_KEY || '';
    this.geminiAvailable = !!apiKey;
    this.ai = new GoogleGenAI({ apiKey });

    if (this.geminiAvailable) {
      console.log('[UnifiedOCR] Initialized — Gemini Vision ready');
    } else {
      console.warn('[UnifiedOCR] Initialized — Gemini API key not set; OCR fallback unavailable');
    }
  }

  static getInstance(): UnifiedOCRService {
    if (!UnifiedOCRService.instance) {
      UnifiedOCRService.instance = new UnifiedOCRService();
    }
    return UnifiedOCRService.instance;
  }

  // ============================================
  // PRIMARY: Extract text from a scanned PDF
  // ============================================

  async extractTextFromScannedPDF(
    buffer: Buffer,
    hint: DocumentHint = 'general'
  ): Promise<OCRResult> {
    const start = Date.now();

    if (!this.geminiAvailable) {
      return {
        success: false,
        text: '',
        provider: 'none',
        confidence: 'unknown',
        processingTimeMs: Date.now() - start,
        error: 'Gemini API key not configured — OCR unavailable',
        usedFallback: false,
      };
    }

    if (buffer.length > MAX_PDF_SIZE_BYTES) {
      return {
        success: false,
        text: '',
        provider: 'none',
        confidence: 'unknown',
        processingTimeMs: Date.now() - start,
        error: `PDF too large for OCR (${(buffer.length / 1024 / 1024).toFixed(1)} MB > 20 MB limit)`,
        usedFallback: false,
      };
    }

    // Helper: call Gemini once and return raw text (throws on API error)
    const callGemini = async (): Promise<string> => {
      const prompt = PROMPT_FOR_HINT[hint];
      const base64Data = buffer.toString('base64');
      const response = await this.ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: [
          {
            role: 'user',
            parts: [
              { inlineData: { mimeType: 'application/pdf', data: base64Data } },
              { text: prompt },
            ],
          },
        ],
      });
      return response.text || '';
    };

    // Helper: compute confidence from extracted text using multiple signals
    const computeConfidence = (text: string): OCRResult['confidence'] => {
      const wordCount = text.split(/\s+/).length;
      // Financial-document signals that raise confidence beyond raw word count
      const hasISIN = /IN[FE0][A-Z0-9]{9}/i.test(text);
      const hasFinancialNumbers = (text.match(/[\d,]+\.\d{2,4}/g) || []).length >= 3;
      const hasDatePattern = /\d{2}[-\/][A-Za-z]{3}[-\/]\d{4}/.test(text);
      const signalBoost = (hasISIN ? 1 : 0) + (hasFinancialNumbers ? 1 : 0) + (hasDatePattern ? 1 : 0);
      // Thresholds: 200 words OR strong financial signals → high; 50 words OR 1 signal → medium
      if (wordCount > 200 || signalBoost >= 2) return 'high';
      if (wordCount > 50 || signalBoost >= 1) return 'medium';
      return 'low';
    };

    // Helper: decide if an error looks like a transient Gemini 5xx that is worth retrying
    const isRetryableError = (err: any): boolean => {
      const msg: string = (err?.message || '').toLowerCase();
      return /5\d{2}|rate.?limit|overloaded|unavailable|timeout|econnreset|socket hang/i.test(msg);
    };

    try {
      let text = '';
      try {
        text = await callGemini();
      } catch (firstErr: any) {
        if (isRetryableError(firstErr)) {
          console.warn('[UnifiedOCR] Gemini transient error — retrying once after 1 s:', firstErr.message);
          await new Promise(resolve => setTimeout(resolve, 1000));
          text = await callGemini(); // second attempt; let it throw if it fails again
        } else {
          throw firstErr;
        }
      }

      if (!text || text.trim().length === 0) {
        return {
          success: false,
          text: '',
          provider: 'gemini',
          confidence: 'unknown',
          processingTimeMs: Date.now() - start,
          error: 'Gemini returned empty text — document may be blank or unreadable',
          usedFallback: true,
        };
      }

      const confidence = computeConfidence(text);
      const wordCount = text.split(/\s+/).length;

      console.log(
        `[UnifiedOCR] Scanned PDF extracted via Gemini: ${wordCount} words, confidence=${confidence}, ${Date.now() - start}ms`
      );

      return {
        success: true,
        text,
        provider: 'gemini',
        confidence,
        processingTimeMs: Date.now() - start,
        usedFallback: true,
      };
    } catch (err: any) {
      const error = err?.message || 'Gemini OCR failed';
      console.error('[UnifiedOCR] Gemini PDF OCR error:', error);
      return {
        success: false,
        text: '',
        provider: 'gemini',
        confidence: 'unknown',
        processingTimeMs: Date.now() - start,
        error,
        usedFallback: true,
      };
    }
  }

  // ============================================
  // Extract text from an image file
  // ============================================

  async extractTextFromImage(
    buffer: Buffer,
    mimeType: Exclude<DocumentMimeType, 'application/pdf'> = 'image/jpeg',
    hint: DocumentHint = 'general'
  ): Promise<OCRResult> {
    const start = Date.now();

    if (!this.geminiAvailable) {
      return {
        success: false,
        text: '',
        provider: 'none',
        confidence: 'unknown',
        processingTimeMs: Date.now() - start,
        error: 'Gemini API key not configured — OCR unavailable',
        usedFallback: false,
      };
    }

    if (buffer.length > MAX_IMAGE_SIZE_BYTES) {
      return {
        success: false,
        text: '',
        provider: 'none',
        confidence: 'unknown',
        processingTimeMs: Date.now() - start,
        error: `Image too large for OCR (${(buffer.length / 1024 / 1024).toFixed(1)} MB > 5 MB limit)`,
        usedFallback: false,
      };
    }

    try {
      const prompt = PROMPT_FOR_HINT[hint];
      const base64Data = buffer.toString('base64');

      const response = await this.ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: base64Data,
                },
              },
              { text: prompt },
            ],
          },
        ],
      });

      const text = response.text || '';

      if (!text || text.trim().length === 0) {
        return {
          success: false,
          text: '',
          provider: 'gemini',
          confidence: 'unknown',
          processingTimeMs: Date.now() - start,
          error: 'Gemini returned empty text for image',
          usedFallback: false,
        };
      }

      const wordCount = text.split(/\s+/).length;
      // Use same multi-signal heuristic as PDF OCR for consistency
      const hasISIN = /IN[FE0][A-Z0-9]{9}/i.test(text);
      const hasFinancialNumbers = (text.match(/[\d,]+\.\d{2,4}/g) || []).length >= 3;
      const hasDatePattern = /\d{2}[-\/][A-Za-z]{3}[-\/]\d{4}/.test(text);
      const signalBoost = (hasISIN ? 1 : 0) + (hasFinancialNumbers ? 1 : 0) + (hasDatePattern ? 1 : 0);
      const confidence: OCRResult['confidence'] =
        wordCount > 200 || signalBoost >= 2 ? 'high'
        : wordCount > 50 || signalBoost >= 1 ? 'medium'
        : 'low';

      console.log(
        `[UnifiedOCR] Image extracted via Gemini: ${wordCount} words, confidence=${confidence}, ${Date.now() - start}ms`
      );

      return {
        success: true,
        text,
        provider: 'gemini',
        confidence,
        processingTimeMs: Date.now() - start,
        usedFallback: false,
      };
    } catch (err: any) {
      const error = err?.message || 'Gemini image OCR failed';
      console.error('[UnifiedOCR] Gemini image OCR error:', error);
      return {
        success: false,
        text: '',
        provider: 'gemini',
        confidence: 'unknown',
        processingTimeMs: Date.now() - start,
        error,
        usedFallback: false,
      };
    }
  }

  // ============================================
  // Universal dispatcher
  // ============================================

  async extractText(
    buffer: Buffer,
    mimeType: DocumentMimeType = 'application/pdf',
    hint: DocumentHint = 'general'
  ): Promise<OCRResult> {
    if (mimeType === 'application/pdf') {
      return this.extractTextFromScannedPDF(buffer, hint);
    }
    return this.extractTextFromImage(
      buffer,
      mimeType as Exclude<DocumentMimeType, 'application/pdf'>,
      hint
    );
  }

  // ============================================
  // Service status
  // ============================================

  getStatus(): OCRStatus {
    const sandboxConfigured = !!(
      process.env.SANDBOX_API_KEY && process.env.SANDBOX_API_SECRET
    );

    return {
      available: this.geminiAvailable || sandboxConfigured,
      providers: {
        gemini: {
          available: this.geminiAvailable,
          model: GEMINI_MODEL,
        },
        sandbox: {
          available: sandboxConfigured,
          endpoints: [
            'POST /it/ocr/form-16/pdf — Form 16 structured extraction',
            'POST /it/ocr/form26as — Form 26AS structured extraction',
          ],
        },
      },
      capabilities: [
        'Scanned PDF text extraction (Gemini Vision)',
        'Image OCR — JPG, PNG, WEBP, HEIC (Gemini Vision)',
        'Financial statement OCR with layout preservation',
        'Tax document OCR — Form 16, Form 26AS (Sandbox.co.in)',
        'KYC document OCR — PAN, Aadhaar, passport',
        'Bank statement OCR',
        'General document OCR',
      ],
    };
  }
}

export const unifiedOCRService = UnifiedOCRService.getInstance();
