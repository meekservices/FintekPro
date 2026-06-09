import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { notifySessionExpired } from "@/contexts/session-context";

// CSRF Token Management
let csrfToken: string | null = null;

// Session ID fallback token (for when cookie-based sessions fail)
let sessionIdToken: string | null = null;

export function storeSessionId(sid: string) {
	sessionIdToken = sid;
	try {
		localStorage.setItem("fintekpro_sid", sid);
	} catch (e) {}
}

export function getStoredSessionId(): string | null {
	if (sessionIdToken) return sessionIdToken;
	try {
		sessionIdToken = localStorage.getItem("fintekpro_sid");
	} catch (e) {}
	return sessionIdToken;
}

export function clearStoredSessionId() {
	sessionIdToken = null;
	try {
		localStorage.removeItem("fintekpro_sid");
	} catch (e) {}
}

// PIN Device Token — localStorage fallback for Chrome 3PCD cookie blocking
let pinDeviceTokenCache: string | null = null;

export function storePinDeviceToken(token: string) {
	pinDeviceTokenCache = token;
	try {
		localStorage.setItem("fintekpro_pin_device_token", token);
	} catch (e) {}
}

export function getStoredPinDeviceToken(): string | null {
	if (pinDeviceTokenCache) return pinDeviceTokenCache;
	try {
		pinDeviceTokenCache = localStorage.getItem("fintekpro_pin_device_token");
	} catch (e) {}
	return pinDeviceTokenCache;
}

export function clearPinDeviceToken() {
	pinDeviceTokenCache = null;
	try {
		localStorage.removeItem("fintekpro_pin_device_token");
	} catch (e) {}
}

export async function fetchCsrfToken(): Promise<string | null> {
	try {
		const res = await fetch("/api/csrf-token", { credentials: "include" });
		if (res.ok) {
			const data = await res.json();
			csrfToken = data.csrfToken;
			return csrfToken;
		}
	} catch (e) {
		console.warn("Failed to fetch CSRF token");
	}
	return null;
}

export function getCsrfToken(): string | null {
	return csrfToken;
}

export function clearCsrfToken(): void {
	csrfToken = null;
	clearStoredSessionId();
}

const EXCLUDED_401_ENDPOINTS = [
	"/api/user",
	"/api/cart",
	"/api/unified-cart",
	"/api/user/preferences",
	"/api/kyc/notification-status",
	"/api/admin/store/categories",
	"/api/admin/store/products",
	"/api/admin/store/audit-logs",
	"/api/admin/pending-orders",
	"/api/admin/kyc/dashboard",
];

let wasEverAuthenticated = false;
let lastAuthenticatedAt: number | null = null;

// Grace period after login before session expired dialog can trigger (in milliseconds)
// This prevents false positives when the browser is still processing the Set-Cookie header
// Increased to 10 seconds to handle slower cookie processing
const AUTH_GRACE_PERIOD_MS = 10000;

export function markUserAuthenticated() {
	wasEverAuthenticated = true;
	lastAuthenticatedAt = Date.now();
	try {
		sessionStorage.setItem("fintekpro_was_authenticated", "true");
		sessionStorage.setItem(
			"fintekpro_auth_timestamp",
			String(lastAuthenticatedAt),
		);
	} catch (e) {}
}

export function checkWasAuthenticated(): boolean {
	if (wasEverAuthenticated) return true;
	try {
		wasEverAuthenticated =
			sessionStorage.getItem("fintekpro_was_authenticated") === "true";
		const storedTimestamp = sessionStorage.getItem("fintekpro_auth_timestamp");
		if (storedTimestamp) {
			lastAuthenticatedAt = Number.parseInt(storedTimestamp, 10);
		}
	} catch (e) {}
	return wasEverAuthenticated;
}

export function clearAuthenticationFlag() {
	wasEverAuthenticated = false;
	lastAuthenticatedAt = null;
	try {
		sessionStorage.removeItem("fintekpro_was_authenticated");
		sessionStorage.removeItem("fintekpro_auth_timestamp");
	} catch (e) {}
}

function isWithinAuthGracePeriod(): boolean {
	if (!lastAuthenticatedAt) {
		// Try to load from sessionStorage
		try {
			const storedTimestamp = sessionStorage.getItem(
				"fintekpro_auth_timestamp",
			);
			if (storedTimestamp) {
				lastAuthenticatedAt = Number.parseInt(storedTimestamp, 10);
			}
		} catch (e) {}
	}

	if (!lastAuthenticatedAt) return false;

	const timeSinceAuth = Date.now() - lastAuthenticatedAt;
	return timeSinceAuth < AUTH_GRACE_PERIOD_MS;
}

function shouldTriggerSessionExpired(url: string): boolean {
	if (!checkWasAuthenticated()) {
		return false;
	}

	// Don't trigger session expired immediately after login
	// This prevents false positives when cookie is still being processed
	if (isWithinAuthGracePeriod()) {
		console.log(
			"[Session] Within auth grace period, skipping session expired trigger",
		);
		return false;
	}

	return !EXCLUDED_401_ENDPOINTS.some((endpoint) => url.includes(endpoint));
}

export class ApiError extends Error {
	status: number;
	code?: string;
	traceId?: string;
	userMessage?: string;
	details?: any;

	constructor(
		message: string,
		status: number,
		options?: {
			code?: string;
			traceId?: string;
			userMessage?: string;
			details?: any;
		},
	) {
		super(message);
		this.name = "ApiError";
		this.status = status;
		this.code = options?.code;
		this.traceId = options?.traceId;
		this.userMessage = options?.userMessage;
		this.details = options?.details;
	}

	getUserFriendlyMessage(): string {
		return this.userMessage || this.message || "An unexpected error occurred";
	}
}

async function throwIfResNotOk(res: Response, url?: string) {
	if (!res.ok) {
		const requestUrl = url || res.url;

		if (res.status === 401 && shouldTriggerSessionExpired(requestUrl)) {
			notifySessionExpired({ url: requestUrl });
			throw new ApiError("Session expired", 401, {
				code: "SESSION_EXPIRED",
				userMessage: "Your session has expired. Please sign in again.",
			});
		}

		try {
			const json = await res.json();

			if (json.success === false) {
				throw new ApiError(
					json.error || json.message || res.statusText,
					res.status,
					{
						code: json.code,
						traceId: json.traceId,
						userMessage: json.message,
						details: json.details,
					},
				);
			}

			const errorMessage = json.error || json.message || res.statusText;
			throw new ApiError(errorMessage, res.status);
		} catch (parseError) {
			if (parseError instanceof ApiError) {
				throw parseError;
			}
			throw new ApiError(res.statusText, res.status);
		}
	}
}

export async function apiRequest(
	arg1: string,
	arg2?: string | RequestInit,
	arg3?: any,
	arg4?: Record<string, string>,
): Promise<any> {
	let url: string;
	let method: string = "GET";
	let body: any = undefined;
	let headers: Record<string, string> = {};
	let otherOptions: RequestInit = {};

	// Pattern detection
	if (
		typeof arg1 === "string" &&
		(arg1.startsWith("/") || arg1.startsWith("http"))
	) {
		// Pattern: apiRequest(url, ...)
		url = arg1;
		if (typeof arg2 === "string") {
			// Pattern: apiRequest(url, method, body, headers)
			method = arg2;
			body = arg3;
			headers = arg4 || {};
		} else if (typeof arg2 === "object" && arg2 !== null) {
			// Pattern: apiRequest(url, options) or apiRequest(url, method, { body, headers })
			if ("method" in arg2 || "headers" in arg2 || "body" in arg2) {
				// Standard RequestInit
				const { method: m, body: b, headers: h, ...rest } = arg2 as RequestInit;
				method = m || "GET";
				body = b;
				headers = (h as Record<string, string>) || {};
				otherOptions = rest;

				// Handle the case where people pass { body: { ... } } instead of stringified body
				if (
					body &&
					typeof body === "object" &&
					!(body instanceof Blob) &&
					!(body instanceof ArrayBuffer) &&
					!(body instanceof FormData)
				) {
					body = JSON.stringify(body);
				}
			} else {
				// Not a RequestInit, maybe additionalOptions: { body, headers }
				// Pattern: apiRequest(url, method, { body, headers }) where method is missing
				// or Pattern: apiRequest(url, { body, headers })
				const opts = arg2 as any;
				body = opts.body;
				headers = opts.headers || {};
			}
		}
	} else if (typeof arg1 === "string") {
		// Pattern: apiRequest(method, url, body, headers)
		method = arg1;
		url = arg2 as string;
		body = arg3;
		headers = arg4 || {};
	} else {
		throw new Error(
			"Invalid apiRequest call: first argument must be a URL or HTTP method.",
		);
	}

	// Final normalization
	const isMutatingRequest = ["POST", "PUT", "PATCH", "DELETE"].includes(
		method.toUpperCase(),
	);

	// Ensure body is stringified for JSON if it's an object
	let serializedBody = body;
	if (
		body !== undefined &&
		typeof body === "object" &&
		!(body instanceof FormData) &&
		!(body instanceof Blob) &&
		!(body instanceof ArrayBuffer)
	) {
		serializedBody = JSON.stringify(body);
	}

	const requestHeaders: Record<string, string> = {
		...headers,
		...(serializedBody && !headers["Content-Type"]
			? { "Content-Type": "application/json" }
			: {}),
		// Session ID fallback header — sent when cookie-based sessions may be broken
		...(getStoredSessionId() ? { "X-Session-ID": getStoredSessionId()! } : {}),
		// PIN Device Token fallback header — sent so isTrustedPinDevice() works even when Chrome 3PCD blocks the cookie
		...(getStoredPinDeviceToken()
			? { "X-Pin-Device-Token": getStoredPinDeviceToken()! }
			: {}),
	};

	if (isMutatingRequest && csrfToken) {
		requestHeaders["X-CSRF-Token"] = csrfToken;
	}

	let res = await fetch(url, {
		method: method.toUpperCase(),
		headers: requestHeaders,
		body: serializedBody,
		credentials: "include",
		...otherOptions,
	});

	if (res.status === 403 && isMutatingRequest) {
		const data = await res
			.clone()
			.json()
			.catch(() => ({}));
		if (
			data.code === "CSRF_TOKEN_REQUIRED" ||
			data.code === "CSRF_TOKEN_INVALID" ||
			data.code === "CSRF_ERROR"
		) {
			if (data.code === "CSRF_TOKEN_INVALID" || data.code === "CSRF_ERROR") {
				clearCsrfToken();
			}

			await fetchCsrfToken();

			if (csrfToken) {
				requestHeaders["X-CSRF-Token"] = csrfToken;
				res = await fetch(url, {
					method: method.toUpperCase(),
					headers: requestHeaders,
					body: serializedBody,
					credentials: "include",
					...otherOptions,
				});
			}
		}
	}

	await throwIfResNotOk(res, url);

	// If the server auto-healed a missing CSRF token, capture it for future requests
	const refreshedToken = res.headers.get("x-csrf-token-refresh");
	if (refreshedToken) {
		csrfToken = refreshedToken;
	}

	const contentType = res.headers.get("content-type");
	if (contentType?.includes("application/json")) {
		return await res.json();
	}

	return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
	on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
	({ on401: unauthorizedBehavior }) =>
	async ({ queryKey }) => {
		const url = queryKey.join("/") as string;
		const res = await fetch(url, {
			credentials: "include",
			headers: {
				...(getStoredSessionId()
					? { "X-Session-ID": getStoredSessionId()! }
					: {}),
			},
		});

		if (res.status === 401 || res.status === 403) {
			if (unauthorizedBehavior === "returnNull") {
				return null;
			}
			if (res.status === 401 && shouldTriggerSessionExpired(url)) {
				notifySessionExpired({ url, queryKey });
				throw new ApiError("Session expired", 401, {
					code: "SESSION_EXPIRED",
					userMessage: "Your session has expired. Please sign in again.",
				});
			}
		}

		await throwIfResNotOk(res, url);
		return await res.json();
	};

function isSlowNetwork(): boolean {
	const connection =
		(navigator as any).connection ||
		(navigator as any).mozConnection ||
		(navigator as any).webkitConnection;

	if (connection) {
		const effectiveType = connection.effectiveType;
		if (effectiveType === "slow-2g" || effectiveType === "2g") {
			return true;
		}
		if (effectiveType === "3g" && connection.rtt && connection.rtt > 400) {
			return true;
		}
		if (connection.downlink !== undefined && connection.downlink < 0.5) {
			return true;
		}
	}
	return false;
}

function getNetworkAwareStaleTime(): number {
	return isSlowNetwork() ? 10 * 60 * 1000 : 5 * 60 * 1000;
}

function getNetworkAwareRetryCount(): number {
	return isSlowNetwork() ? 4 : 2;
}

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			queryFn: getQueryFn({ on401: "throw" }),
			refetchInterval: false,
			refetchOnWindowFocus: false,
			staleTime: 5 * 60 * 1000,
			gcTime: 15 * 60 * 1000,
			networkMode: "offlineFirst",
			retry: (failureCount, error: any) => {
				const maxRetries = getNetworkAwareRetryCount();

				if (error instanceof ApiError) {
					if (error.status >= 400 && error.status < 500) {
						if (error.status === 408 || error.status === 429) {
							return failureCount < maxRetries + 1;
						}
						return false;
					}
					return failureCount < maxRetries;
				}

				if (error?.name === "TypeError" && error?.message?.includes("fetch")) {
					return failureCount < maxRetries + 2;
				}

				return failureCount < maxRetries;
			},
			retryDelay: (attemptIndex, error) => {
				const baseDelay = isSlowNetwork() ? 2000 : 1000;
				const maxDelay = isSlowNetwork() ? 60000 : 30000;

				if (error instanceof ApiError && error.status === 429) {
					return Math.min(5000 * 2 ** attemptIndex, 60000);
				}

				return Math.min(baseDelay * 2 ** attemptIndex, maxDelay);
			},
		},
		mutations: {
			retry: (failureCount, error: any) => {
				const maxRetries = isSlowNetwork() ? 2 : 1;

				if (error instanceof ApiError) {
					if (error.status >= 500 || !error.status) {
						return failureCount < maxRetries;
					}
					if (error.status === 429) {
						return failureCount < maxRetries;
					}
				}

				if (error?.name === "TypeError" && error?.message?.includes("fetch")) {
					return failureCount < maxRetries + 1;
				}

				return false;
			},
			retryDelay: (attemptIndex, error) => {
				const baseDelay = isSlowNetwork() ? 4000 : 2000;

				if (error instanceof ApiError && error.status === 429) {
					return 5000;
				}
				return baseDelay * (attemptIndex + 1);
			},
		},
	},
});
