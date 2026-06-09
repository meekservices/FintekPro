import { Request, Response, NextFunction } from "express";

/**
 * Masks a PAN (Permanent Account Number) string
 * Format: ABCDE1234F -> ABCD****4F
 * Keeps first 4 and last 2 characters, masks middle 4 characters
 */
export function maskPAN(pan: string): string {
	if (!pan || typeof pan !== "string") return pan;

	// Remove spaces and convert to uppercase
	const cleanPan = pan.replace(/\s/g, "").toUpperCase();

	// Validate PAN format (5 letters + 4 digits + 1 letter = 10 chars)
	if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(cleanPan)) {
		return pan; // Return original if not valid PAN format
	}

	// Mask: keep first 4, mask 4 middle, keep last 2
	return cleanPan.slice(0, 4) + "****" + cleanPan.slice(-2);
}

/**
 * Masks an Aadhaar number
 * Format: 123456789012 -> XXXX XXXX 9012
 * Shows only the last 4 digits
 */
export function maskAadhaar(aadhaar: string): string {
	if (!aadhaar || typeof aadhaar !== "string") return aadhaar;

	// Remove spaces and dashes
	const cleanAadhaar = aadhaar.replace(/[\s\-]/g, "");

	// Validate Aadhaar format (12 digits)
	if (!/^\d{12}$/.test(cleanAadhaar)) {
		return aadhaar; // Return original if not valid Aadhaar format
	}

	// Format and mask: XXXX XXXX 9012
	return "XXXX XXXX " + cleanAadhaar.slice(-4);
}

/**
 * Patterns to detect PAN and Aadhaar in string values
 */
const PAN_PATTERN = /[A-Z]{5}[0-9]{4}[A-Z]/g;
const AADHAAR_PATTERN = /\d{4}[\s\-]?\d{4}[\s\-]?\d{4}/g;

/**
 * Sensitive field names to mask (case-insensitive)
 */
const SENSITIVE_FIELD_NAMES = [
	"pan",
	"pannumber",
	"pan_number",
	"aadhaar",
	"aadhaar_number",
	"aadharnumber",
	"aadhar",
	"aadhar_number",
	"aadharnumber",
];

/**
 * Recursively scans an object and masks sensitive fields
 * Mutates the object in place
 */
export function maskSensitiveFields(obj: any, visited = new WeakSet()): any {
	// Handle null, undefined, and primitives
	if (obj === null || obj === undefined) return obj;
	if (typeof obj !== "object") return obj;

	// Prevent infinite loops on circular references
	if (visited.has(obj)) return obj;
	visited.add(obj);

	// Handle arrays
	if (Array.isArray(obj)) {
		for (let i = 0; i < obj.length; i++) {
			if (typeof obj[i] === "string") {
				obj[i] = maskSensitiveStrings(obj[i]);
			} else if (typeof obj[i] === "object" && obj[i] !== null) {
				maskSensitiveFields(obj[i], visited);
			}
		}
		return obj;
	}

	// Handle objects
	for (const key in obj) {
		if (Object.prototype.hasOwnProperty.call(obj, key)) {
			const lowerKey = key.toLowerCase();

			// Check if this is a sensitive field name
			if (SENSITIVE_FIELD_NAMES.includes(lowerKey)) {
				const value = obj[key];

				if (typeof value === "string") {
					// Determine which masking function to use based on field name
					if (lowerKey.includes("pan")) {
						obj[key] = maskPAN(value);
					} else if (
						lowerKey.includes("aadhaar") ||
						lowerKey.includes("aadhar")
					) {
						obj[key] = maskAadhaar(value);
					}
				} else if (Array.isArray(value)) {
					// If it's an array of strings, mask each one
					for (let i = 0; i < value.length; i++) {
						if (typeof value[i] === "string") {
							if (lowerKey.includes("pan")) {
								value[i] = maskPAN(value[i]);
							} else if (
								lowerKey.includes("aadhaar") ||
								lowerKey.includes("aadhar")
							) {
								value[i] = maskAadhaar(value[i]);
							}
						}
					}
				}
			}

			// Recursively process nested objects
			if (typeof obj[key] === "object" && obj[key] !== null) {
				maskSensitiveFields(obj[key], visited);
			} else if (typeof obj[key] === "string") {
				// Mask patterns in string values (but not in sensitive field names we already handled)
				obj[key] = maskSensitiveStrings(obj[key]);
			}
		}
	}

	return obj;
}

/**
 * Masks PAN and Aadhaar patterns found in string values
 * This catches unstructured data that might contain these numbers
 */
function maskSensitiveStrings(str: string): string {
	if (!str || typeof str !== "string") return str;

	let result = str;

	// Mask PAN patterns
	result = result.replace(PAN_PATTERN, (pan) => maskPAN(pan));

	// Mask Aadhaar patterns (12 consecutive digits, optionally with spaces/dashes)
	result = result.replace(AADHAAR_PATTERN, (aadhaar) => maskAadhaar(aadhaar));

	return result;
}

/**
 * Paths that should NOT be masked (they need full values for verification)
 * These paths are explicitly allowed to return unmasked sensitive data
 */
const EXEMPT_PATHS = [
	"/api/kyc/verify-pan",
	"/api/kyc/verify-aadhaar",
	"/api/ckyc/search",
	"/api/ckyc/register",
	"/api/sandbox-itr/test-data",
	"/api/kyc/sandbox-info",
];

function shouldSkipMasking(path: string, method: string): boolean {
	if (path.includes("/webhook") || path.includes("/webhooks")) {
		return true;
	}

	if (EXEMPT_PATHS.some((exemptPath) => path === exemptPath)) {
		return true;
	}

	if (method !== "POST") {
		return false;
	}

	return false;
}

/**
 * Express middleware that intercepts JSON responses and masks sensitive data
 * Usage: app.use(sensitiveDataMaskingMiddleware);
 */
export function sensitiveDataMaskingMiddleware(
	req: Request,
	res: Response,
	next: NextFunction,
): void {
	if (shouldSkipMasking(req.path, req.method)) {
		return next();
	}

	// Store the original json function
	const originalJson = res.json.bind(res);

	// Override res.json() to intercept and mask responses
	res.json = (body: any) => {
		// Only process if the body is an object (not primitives like strings/numbers)
		if (body && typeof body === "object") {
			// Deep clone to avoid mutating original data in edge cases
			// But for performance, we'll mutate in place since it's the response
			maskSensitiveFields(body);
		}

		// Call the original json function with masked data
		return originalJson(body);
	};

	next();
}

/**
 * Sanitizes log data to remove sensitive information
 * Can be used in the logger to strip PAN/Aadhaar from logs
 * Usage: logger.info('message', sanitizeLogData(data));
 */
export function sanitizeLogData(data: any): any {
	if (data === null || data === undefined) return data;

	// For strings, just mask the patterns
	if (typeof data === "string") {
		return maskSensitiveStrings(data);
	}

	// For objects, create a deep clone and mask fields
	if (typeof data === "object") {
		let cloned: any;

		if (Array.isArray(data)) {
			cloned = [...data];
		} else {
			// Deep clone to avoid mutating original log data
			try {
				cloned = JSON.parse(JSON.stringify(data));
			} catch {
				// If cloning fails, return a safe error object
				return { _error: "Unable to serialize log data" };
			}
		}

		// Mask sensitive fields in the clone
		return maskSensitiveFields(cloned);
	}

	return data;
}

/**
 * Utility function to check if a string looks like a PAN
 */
export function looksLikePAN(str: string): boolean {
	if (!str || typeof str !== "string") return false;
	return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(str.replace(/\s/g, "").toUpperCase());
}

/**
 * Utility function to check if a string looks like an Aadhaar
 */
export function looksLikeAadhaar(str: string): boolean {
	if (!str || typeof str !== "string") return false;
	const clean = str.replace(/[\s\-]/g, "");
	return /^\d{12}$/.test(clean);
}
