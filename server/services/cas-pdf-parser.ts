/**
 * CAS PDF Parser — Consolidated Account Statement (CAMS / KFintech / MFCentral)
 *
 * Purpose : Parse CAMS and KFintech CAS PDFs — including password-protected ones —
 *           and return structured holdings ready to persist into comprehensiveHoldings.
 *
 * Password convention (SEBI-mandated):
 *   CAMS CAS    → first 5 chars of PAN (uppercase) + DOB as DDMMYYYY
 *   KFintech CAS → same formula
 *   Example    : PAN ABCDE1234F, DOB 15-Aug-1990 → "ABCDE15081990"
 *
 * GCR FASP-AI: PAN and DOB used only to derive decryption key — never logged.
 */

import * as pdfParseModule from "pdf-parse";
const pdfParse = (pdfParseModule as any).default ?? pdfParseModule;
import { logger } from "../logger";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParsedCasHolding {
  isin?: string;
  schemeName: string;
  registrar: "cams" | "kfintech" | "unknown";
  folioNumber: string;
  units: number;
  nav: number;
  currentValue: number;
  costValue?: number;
  unrealisedGain?: number;
  plan: "direct" | "regular" | "unknown";
  option: "growth" | "idcw" | "unknown";
}

export class CasPdfDecryptError extends Error {
  constructor(pan: string) {
    super(
      `CAS PDF is password-protected and the auto-derived password did not work. ` +
      `Please verify the investor PAN (${pan.slice(0, 3)}**) and Date of Birth.`
    );
    this.name = "CasPdfDecryptError";
  }
}

export class CasPdfParseError extends Error {
  constructor(detail: string) {
    super(`CAS PDF could not be parsed: ${detail}`);
    this.name = "CasPdfParseError";
  }
}

// ─── Password derivation ──────────────────────────────────────────────────────

/**
 * Derives the standard SEBI CAS PDF password.
 * Formula: PAN[0..4].toUpperCase() + DOB formatted as DDMMYYYY
 */
export function deriveCasPassword(pan: string, dob: string): string {
  const panPrefix = pan.slice(0, 5).toUpperCase();
  let dobNorm = dob.replace(/[^0-9]/g, "");
  // Handle ISO format YYYYMMDD → DDMMYYYY
  if (dobNorm.length === 8 && parseInt(dobNorm.slice(0, 4)) > 1900) {
    dobNorm = dobNorm.slice(6, 8) + dobNorm.slice(4, 6) + dobNorm.slice(0, 4);
  }
  return panPrefix + dobNorm;
}

// ─── PDF text extraction ──────────────────────────────────────────────────────

async function extractPdfText(buffer: Buffer, password?: string): Promise<string> {
  const options: Record<string, unknown> = {};
  if (password) options.password = password;
  try {
    const result = await pdfParse(buffer, options as Parameters<typeof pdfParse>[1]);
    return result.text;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("password") || msg.includes("encrypted") || msg.includes("decrypt")) {
      throw new CasPdfDecryptError("PAN-masked");
    }
    throw new CasPdfParseError(msg);
  }
}

// ─── Registrar detection ──────────────────────────────────────────────────────

function detectRegistrar(text: string): "cams" | "kfintech" | "unknown" {
  if (/CAMS|Computer Age Management/i.test(text)) return "cams";
  if (/KFintech|Karvy\s*Fintech/i.test(text)) return "kfintech";
  return "unknown";
}

// ─── CAS text layout parser ───────────────────────────────────────────────────

function parseHoldingsFromText(
  text: string,
  registrar: "cams" | "kfintech" | "unknown"
): ParsedCasHolding[] {
  const holdings: ParsedCasHolding[] = [];
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  let currentFolio = "";
  let currentScheme = "";
  let currentIsin: string | undefined;
  let currentPlan: ParsedCasHolding["plan"] = "unknown";
  let currentOption: ParsedCasHolding["option"] = "unknown";

  const folioRe = /Folio\s*(?:No\.?|Number)?[\s:]+([A-Z0-9\/\-]+)/i;
  const isinRe = /ISIN\s*:\s*([A-Z]{2}[A-Z0-9]{10})/i;
  const holdingLineRe = /^([\d,]+\.\d{2,4})\s+([\d,]+\.\d{2,4})\s+([\d,]+\.?\d{0,2})$/;
  const costRe = /(?:Purchase|Cost)\s+Value\s*:?\s*[₹\s]*([\d,]+\.?\d{0,2})/i;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const folioMatch = line.match(folioRe);
    if (folioMatch) { currentFolio = folioMatch[1].trim(); continue; }

    const isinMatch = line.match(isinRe);
    if (isinMatch) {
      currentIsin = isinMatch[1];
      currentScheme = line.replace(/\s*[\(\[]\s*ISIN\s*:.*$/i, "").trim();
    } else if (
      currentFolio && !holdingLineRe.test(line) && line.length > 10 &&
      !/^[₹\d,\s\.]+$/.test(line) &&
      !/^(Total|Closing|Opening|NAV|Units|Value|Date)/i.test(line)
    ) {
      currentScheme = line;
      currentIsin = undefined;
    }

    if (currentScheme) {
      currentPlan = /direct/i.test(currentScheme) ? "direct" : /regular/i.test(currentScheme) ? "regular" : "unknown";
      currentOption = /growth/i.test(currentScheme) ? "growth" : /idcw|dividend/i.test(currentScheme) ? "idcw" : "unknown";
    }

    const holdingMatch = line.match(holdingLineRe);
    if (holdingMatch && currentFolio && currentScheme) {
      const units = parseFloat(holdingMatch[1].replace(/,/g, ""));
      const nav = parseFloat(holdingMatch[2].replace(/,/g, ""));
      const currentValue = parseFloat(holdingMatch[3].replace(/,/g, ""));

      let costValue: number | undefined;
      for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
        const costMatch = lines[j].match(costRe);
        if (costMatch) { costValue = parseFloat(costMatch[1].replace(/,/g, "")); break; }
      }

      holdings.push({
        isin: currentIsin,
        schemeName: currentScheme,
        registrar,
        folioNumber: currentFolio,
        units, nav, currentValue, costValue,
        unrealisedGain: costValue !== undefined ? currentValue - costValue : undefined,
        plan: currentPlan,
        option: currentOption,
      });
    }
  }
  return holdings;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parses a CAMS or KFintech CAS PDF buffer into structured holdings.
 *
 * @param fileBuffer - Raw PDF bytes
 * @param pan        - Investor PAN (used to derive decryption password — never logged)
 * @param dob        - DOB in any common format (used to derive password — never logged)
 *
 * @throws CasPdfDecryptError  - Encrypted PDF and derived password failed
 * @throws CasPdfParseError    - Corrupt or unrecognised layout
 *
 * GCR Security: PAN + DOB are PII. Used only for key derivation. Not stored, not logged.
 */
export async function parseCasPdf(
  fileBuffer: Buffer,
  pan: string,
  dob: string
): Promise<ParsedCasHolding[]> {
  const safeCtx = { event: "CAS_PDF_PARSE", pan_prefix: pan.slice(0, 3) + "**" };

  let text: string;

  try {
    text = await extractPdfText(fileBuffer);
    logger.info("CAS PDF opened without password", { ...safeCtx, status: "unencrypted" });
  } catch (err) {
    if (!(err instanceof CasPdfDecryptError)) throw err;

    const password = deriveCasPassword(pan, dob);
    logger.info("CAS PDF encrypted — retrying with derived password", {
      ...safeCtx, password_len: password.length,
    });

    try {
      text = await extractPdfText(fileBuffer, password);
      logger.info("CAS PDF decrypted successfully", { ...safeCtx, status: "decrypted" });
    } catch {
      throw new CasPdfDecryptError(pan);
    }
  }

  const registrar = detectRegistrar(text);
  const holdings = parseHoldingsFromText(text, registrar);

  if (holdings.length === 0) {
    logger.warn("CAS PDF parsed but 0 holdings found", {
      ...safeCtx, registrar, text_length: text.length,
    });
  }

  logger.info("CAS PDF parse complete", {
    ...safeCtx, registrar,
    total: holdings.length,
    isin_count: holdings.filter((h) => h.isin).length,
  });

  return holdings;
}
