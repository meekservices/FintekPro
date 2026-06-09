/**
 * Outbound fetch wrapper with mandatory timeout.
 *
 * Every outbound HTTP call MUST use this instead of bare fetch() to prevent
 * a slow third-party API from hanging a Node.js worker indefinitely.
 *
 * Default timeout: 15 seconds. Override per-call via options.timeoutMs.
 * On timeout, throws a plain Error with message "Request timed out after Xms".
 */

export const DEFAULT_FETCH_TIMEOUT_MS = 15_000;

export interface FetchWithTimeoutOptions extends RequestInit {
	timeoutMs?: number;
}

export async function fetchWithTimeout(
	url: string,
	options: FetchWithTimeoutOptions = {},
): Promise<Response> {
	const { timeoutMs = DEFAULT_FETCH_TIMEOUT_MS, ...fetchOptions } = options;
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const response = await fetch(url, {
			...fetchOptions,
			signal: controller.signal,
		});
		return response;
	} catch (err: any) {
		if (err?.name === "AbortError") {
			throw new Error(`Request timed out after ${timeoutMs}ms: ${url}`);
		}
		throw err;
	} finally {
		clearTimeout(timer);
	}
}
