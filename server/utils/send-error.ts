/**
 * sendError — Standardised GCR-compliant error response helper
 *
 * Purpose:  Emit `{ error_code, message, retryable }` error envelopes from
 *           any route handler with a single, consistent call.
 * Inputs:   res      — Express Response object
 *           status   — HTTP status code (4xx / 5xx)
 *           errorCode — Snake-case error code string (e.g. "INVALID_INPUT")
 *           message  — Human-readable error message
 *           retryable — Whether the caller can retry safely (default false)
 * Outputs:  Sends JSON response and returns void.
 * Edge cases: Logs every 5xx at error severity with structured context.
 *
 * @module server/utils/send-error
 */

import { Response } from "express";
import { logger } from "../logger";

export interface ErrorEnvelope {
  success: false;
  error_code: string;
  message: string;
  retryable: boolean;
  meta: {
    timestamp: string;
    version: string;
  };
}

/**
 * Send a GCR-compliant error response.
 *
 * @param res       - Express Response
 * @param status    - HTTP status code
 * @param errorCode - Snake-case error code
 * @param message   - Human-readable description
 * @param retryable - Whether the client should retry (default: false)
 */
export function sendError(
  res: Response,
  status: number,
  errorCode: string,
  message: string,
  retryable = false,
): void {
  const envelope: ErrorEnvelope = {
    success:    false,
    error_code: errorCode,
    message,
    retryable,
    meta: {
      timestamp: new Date().toISOString(),
      version:   "1.0",
    },
  };

  if (status >= 500) {
    logger.error(errorCode, {
      event:      errorCode,
      error_code: errorCode,
      message,
      status,
      retryable,
    });
  }

  res.status(status).json(envelope);
}

