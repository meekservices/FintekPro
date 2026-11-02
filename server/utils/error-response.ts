/**
 * error-response.ts — GCR v1.0 standard error response factory.
 *
 * Purpose: Produces `{ error_code, message, retryable, meta }` for all error responses.
 *          Replaces ad-hoc `res.status(500).json({ error: error.message })` patterns (M-03).
 * Inputs:  error_code, message, retryable flag, optional HTTP status
 * Outputs: Structured error object conforming to GCR v1.0 error format
 */

export interface GcrErrorResponse {
	error_code: string;
	message: string;
	retryable: boolean;
	meta: {
		timestamp: string;
		version: string;
	};
}

/** Standard error codes — use these for consistent client-side error handling */
export const ErrorCode = {
	INVALID_INPUT: "INVALID_INPUT",
	UNAUTHORIZED: "UNAUTHORIZED",
	FORBIDDEN: "FORBIDDEN",
	NOT_FOUND: "NOT_FOUND",
	RATE_LIMITED: "RATE_LIMITED",
	INTERNAL_ERROR: "INTERNAL_ERROR",
	SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
	CONFLICT: "CONFLICT",
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Creates a GCR v1.0 compliant error response object.
 *
 * @param error_code - Machine-readable error code (use ErrorCode constants)
 * @param message - Human-readable error description
 * @param retryable - Whether the client should retry this request
 * @returns Structured error response conforming to `{ error_code, message, retryable, meta }`
 *
 * @example
 * res.status(500).json(errorResponse("INTERNAL_ERROR", error.message, true));
 * res.status(400).json(errorResponse("INVALID_INPUT", "clientId is required", false));
 */
export function errorResponse(
	error_code: string,
	message: string,
	retryable: boolean,
): GcrErrorResponse {
	return {
		error_code,
		message,
		retryable,
		meta: {
			timestamp: new Date().toISOString(),
			version: "1.0",
		},
	};
}

