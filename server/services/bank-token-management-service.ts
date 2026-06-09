/**
 * Bank Token Management Service
 *
 * Manages OAuth 2.0 tokens for bank APIs with automatic refresh.
 * Tokens are encrypted at rest and refreshed before expiry.
 *
 * Features:
 * - Encrypted token storage
 * - Automatic refresh before expiry
 * - Token caching for performance
 * - Circuit breaker for failed refreshes
 * - Support for multiple grant types
 */

import { db } from "../db";
import {
	bankOAuthTokens,
	type BankOAuthToken,
	type InsertBankOAuthToken,
} from "@shared/dsa-loan-schema";
import { encryptionService } from "../encryption-service";
import {
	bankCredentialsVaultService,
	type Environment,
	type CredentialType,
} from "./bank-credentials-vault-service";
import { eq, and, lt, desc } from "drizzle-orm";
import axios from "axios";
import crypto from "crypto";

export interface TokenConfig {
	bankCode: string;
	environment: Environment;
	tokenEndpoint: string;
	clientId: string;
	grantType: "client_credentials" | "authorization_code" | "refresh_token";
	scope?: string;
	additionalParams?: Record<string, string>;
}

export interface Token {
	accessToken: string;
	refreshToken?: string;
	expiresAt: Date;
	tokenType: string;
	scope?: string;
}

interface TokenCacheEntry {
	token: Token;
	cachedAt: Date;
}

interface CircuitBreakerState {
	failures: number;
	lastFailure: Date | null;
	isOpen: boolean;
}

class BankTokenManagementService {
	private tokenCache: Map<string, TokenCacheEntry> = new Map();
	private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
	private refreshTimers: Map<string, NodeJS.Timeout> = new Map();

	private readonly CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
	private readonly REFRESH_BUFFER_MS = 5 * 60 * 1000; // Refresh 5 minutes before expiry
	private readonly CIRCUIT_BREAKER_THRESHOLD = 3;
	private readonly CIRCUIT_BREAKER_RESET_MS = 60 * 1000; // 1 minute

	/**
	 * Get a valid access token for a bank
	 * Returns cached token if valid, refreshes if needed, or obtains new token
	 */
	async getAccessToken(
		bankCode: string,
		environment: Environment,
	): Promise<string | null> {
		const cacheKey = `${bankCode}:${environment}`;

		// Check circuit breaker
		if (this.isCircuitBreakerOpen(cacheKey)) {
			console.warn(`[TokenMgmt] Circuit breaker open for ${cacheKey}`);
			return null;
		}

		// Check cache first
		const cached = this.tokenCache.get(cacheKey);
		if (cached && this.isTokenValid(cached.token)) {
			return cached.token.accessToken;
		}

		// Try to get from database
		const storedToken = await this.getStoredToken(bankCode, environment);
		if (storedToken && this.isTokenValid(storedToken)) {
			this.cacheToken(cacheKey, storedToken);
			return storedToken.accessToken;
		}

		// Need to refresh or obtain new token
		if (storedToken?.refreshToken) {
			const refreshed = await this.refreshToken(
				bankCode,
				environment,
				storedToken.refreshToken,
			);
			if (refreshed) {
				return refreshed.accessToken;
			}
		}

		// Obtain new token using client credentials
		const newToken = await this.obtainNewToken(bankCode, environment);
		if (newToken) {
			return newToken.accessToken;
		}

		return null;
	}

	/**
	 * Obtain a new token using client credentials grant
	 */
	async obtainNewToken(
		bankCode: string,
		environment: Environment,
	): Promise<Token | null> {
		try {
			// Get credentials from vault
			const credentials = await bankCredentialsVaultService.getBankCredentials(
				bankCode,
				["client_id", "client_secret"],
				environment,
			);

			const clientId = credentials.get("client_id");
			const clientSecret = credentials.get("client_secret");

			if (!clientId || !clientSecret) {
				console.error(
					`[TokenMgmt] Missing credentials for ${bankCode}/${environment}`,
				);
				return null;
			}

			// Get token endpoint from bank connector config
			const tokenEndpoint = await this.getTokenEndpoint(bankCode);
			if (!tokenEndpoint) {
				console.error(
					`[TokenMgmt] No token endpoint configured for ${bankCode}`,
				);
				return null;
			}

			const response = await axios.post(
				tokenEndpoint,
				new URLSearchParams({
					grant_type: "client_credentials",
					client_id: clientId,
					client_secret: clientSecret,
				}).toString(),
				{
					headers: {
						"Content-Type": "application/x-www-form-urlencoded",
					},
					timeout: 30000,
				},
			);

			const token = this.parseTokenResponse(response.data);
			if (token) {
				await this.storeToken(bankCode, environment, token, clientId);
				this.cacheToken(`${bankCode}:${environment}`, token);
				this.scheduleRefresh(bankCode, environment, token);
				this.resetCircuitBreaker(`${bankCode}:${environment}`);

				console.log(
					`[TokenMgmt] Obtained new token for ${bankCode}/${environment}`,
				);
				return token;
			}

			return null;
		} catch (error: any) {
			console.error(
				`[TokenMgmt] Error obtaining token for ${bankCode}:`,
				error.message,
			);
			this.recordFailure(`${bankCode}:${environment}`);
			return null;
		}
	}

	/**
	 * Refresh an existing token
	 */
	async refreshToken(
		bankCode: string,
		environment: Environment,
		refreshToken: string,
	): Promise<Token | null> {
		try {
			const credentials = await bankCredentialsVaultService.getBankCredentials(
				bankCode,
				["client_id", "client_secret"],
				environment,
			);

			const clientId = credentials.get("client_id");
			const clientSecret = credentials.get("client_secret");

			if (!clientId) {
				return null;
			}

			const tokenEndpoint = await this.getTokenEndpoint(bankCode);
			if (!tokenEndpoint) {
				return null;
			}

			const params: Record<string, string> = {
				grant_type: "refresh_token",
				refresh_token: refreshToken,
				client_id: clientId,
			};

			if (clientSecret) {
				params.client_secret = clientSecret;
			}

			const response = await axios.post(
				tokenEndpoint,
				new URLSearchParams(params).toString(),
				{
					headers: {
						"Content-Type": "application/x-www-form-urlencoded",
					},
					timeout: 30000,
				},
			);

			const token = this.parseTokenResponse(response.data);
			if (token) {
				await this.storeToken(bankCode, environment, token, clientId, true);
				this.cacheToken(`${bankCode}:${environment}`, token);
				this.scheduleRefresh(bankCode, environment, token);
				this.resetCircuitBreaker(`${bankCode}:${environment}`);

				console.log(
					`[TokenMgmt] Refreshed token for ${bankCode}/${environment}`,
				);
				return token;
			}

			return null;
		} catch (error: any) {
			console.error(
				`[TokenMgmt] Error refreshing token for ${bankCode}:`,
				error.message,
			);
			this.recordFailure(`${bankCode}:${environment}`);
			return null;
		}
	}

	/**
	 * Store a token in the database (encrypted)
	 */
	private async storeToken(
		bankCode: string,
		environment: Environment,
		token: Token,
		clientId: string,
		isRefresh: boolean = false,
	): Promise<void> {
		try {
			// Encrypt tokens
			const encryptedAccessToken = encryptionService.encrypt(token.accessToken);
			const encryptedRefreshToken = token.refreshToken
				? encryptionService.encrypt(token.refreshToken)
				: null;

			if (!encryptedAccessToken) {
				throw new Error("Failed to encrypt access token");
			}

			// Deactivate existing tokens
			await db
				.update(bankOAuthTokens)
				.set({ status: "expired", updatedAt: new Date() })
				.where(
					and(
						eq(bankOAuthTokens.bankCode, bankCode),
						eq(bankOAuthTokens.environment, environment),
						eq(bankOAuthTokens.status, "active"),
					),
				);

			// Get current refresh count
			const [existing] = await db
				.select({ refreshCount: bankOAuthTokens.refreshCount })
				.from(bankOAuthTokens)
				.where(
					and(
						eq(bankOAuthTokens.bankCode, bankCode),
						eq(bankOAuthTokens.environment, environment),
					),
				)
				.orderBy(desc(bankOAuthTokens.createdAt))
				.limit(1);

			// Insert new token
			await db.insert(bankOAuthTokens).values({
				bankCode,
				environment,
				accessToken: encryptedAccessToken,
				refreshToken: encryptedRefreshToken,
				tokenType: token.tokenType,
				scope: token.scope,
				expiresAt: token.expiresAt,
				issuedAt: new Date(),
				refreshCount: isRefresh ? (existing?.refreshCount || 0) + 1 : 0,
				status: "active",
				metadata: {
					clientId,
					grantType: isRefresh ? "refresh_token" : "client_credentials",
				},
			});
		} catch (error: any) {
			console.error("[TokenMgmt] Error storing token:", error.message);
			throw error;
		}
	}

	/**
	 * Get stored token from database
	 */
	private async getStoredToken(
		bankCode: string,
		environment: Environment,
	): Promise<Token | null> {
		try {
			const [stored] = await db
				.select()
				.from(bankOAuthTokens)
				.where(
					and(
						eq(bankOAuthTokens.bankCode, bankCode),
						eq(bankOAuthTokens.environment, environment),
						eq(bankOAuthTokens.status, "active"),
					),
				)
				.orderBy(desc(bankOAuthTokens.createdAt))
				.limit(1);

			if (!stored) {
				return null;
			}

			// Decrypt tokens
			const accessToken = encryptionService.decrypt(stored.accessToken);
			const refreshToken = stored.refreshToken
				? encryptionService.decrypt(stored.refreshToken)
				: undefined;

			if (!accessToken) {
				return null;
			}

			// Update last used
			await db
				.update(bankOAuthTokens)
				.set({ lastUsed: new Date() })
				.where(eq(bankOAuthTokens.id, stored.id));

			return {
				accessToken,
				refreshToken: refreshToken || undefined,
				expiresAt: stored.expiresAt,
				tokenType: stored.tokenType || "Bearer",
				scope: stored.scope || undefined,
			};
		} catch (error: any) {
			console.error("[TokenMgmt] Error getting stored token:", error.message);
			return null;
		}
	}

	/**
	 * Parse token response from OAuth server
	 */
	private parseTokenResponse(data: any): Token | null {
		if (!data.access_token) {
			return null;
		}

		const expiresIn = data.expires_in || 3600; // Default 1 hour
		const expiresAt = new Date(Date.now() + expiresIn * 1000);

		return {
			accessToken: data.access_token,
			refreshToken: data.refresh_token,
			expiresAt,
			tokenType: data.token_type || "Bearer",
			scope: data.scope,
		};
	}

	/**
	 * Check if token is still valid
	 */
	private isTokenValid(token: Token): boolean {
		const now = new Date();
		const bufferTime = new Date(
			token.expiresAt.getTime() - this.REFRESH_BUFFER_MS,
		);
		return now < bufferTime;
	}

	/**
	 * Cache a token in memory
	 */
	private cacheToken(key: string, token: Token): void {
		this.tokenCache.set(key, {
			token,
			cachedAt: new Date(),
		});
	}

	/**
	 * Schedule automatic token refresh
	 */
	private scheduleRefresh(
		bankCode: string,
		environment: Environment,
		token: Token,
	): void {
		const key = `${bankCode}:${environment}`;

		// Clear existing timer
		const existingTimer = this.refreshTimers.get(key);
		if (existingTimer) {
			clearTimeout(existingTimer);
		}

		// Calculate time until refresh needed
		const refreshTime =
			token.expiresAt.getTime() - this.REFRESH_BUFFER_MS - Date.now();

		if (refreshTime > 0) {
			const timer = setTimeout(async () => {
				console.log(`[TokenMgmt] Auto-refreshing token for ${key}`);
				if (token.refreshToken) {
					await this.refreshToken(bankCode, environment, token.refreshToken);
				} else {
					await this.obtainNewToken(bankCode, environment);
				}
			}, refreshTime);

			this.refreshTimers.set(key, timer);
		}
	}

	/**
	 * Get token endpoint for a bank
	 */
	private async getTokenEndpoint(bankCode: string): Promise<string | null> {
		// This would typically come from bank connector config
		// For now, return mock endpoints based on bank code
		const endpoints: Record<string, string> = {
			ICICI: "https://apigw.icicibank.com/oauth/token",
			HDFC: "https://api.hdfcbank.com/oauth/token",
			BAJAJ: "https://api.bajajfinance.com/oauth/token",
			TATA: "https://api.tatacapital.com/oauth/token",
			KOTAK: "https://api.kotak.com/oauth/token",
		};

		return endpoints[bankCode.toUpperCase()] || null;
	}

	/**
	 * Circuit breaker methods
	 */
	private isCircuitBreakerOpen(key: string): boolean {
		const state = this.circuitBreakers.get(key);
		if (!state || !state.isOpen) return false;

		// Check if circuit breaker should reset
		if (
			state.lastFailure &&
			Date.now() - state.lastFailure.getTime() > this.CIRCUIT_BREAKER_RESET_MS
		) {
			state.isOpen = false;
			state.failures = 0;
			return false;
		}

		return true;
	}

	private recordFailure(key: string): void {
		const state = this.circuitBreakers.get(key) || {
			failures: 0,
			lastFailure: null,
			isOpen: false,
		};
		state.failures++;
		state.lastFailure = new Date();

		if (state.failures >= this.CIRCUIT_BREAKER_THRESHOLD) {
			state.isOpen = true;
			console.warn(`[TokenMgmt] Circuit breaker opened for ${key}`);
		}

		this.circuitBreakers.set(key, state);
	}

	private resetCircuitBreaker(key: string): void {
		this.circuitBreakers.set(key, {
			failures: 0,
			lastFailure: null,
			isOpen: false,
		});
	}

	/**
	 * Revoke a token
	 */
	async revokeToken(
		bankCode: string,
		environment: Environment,
	): Promise<boolean> {
		try {
			await db
				.update(bankOAuthTokens)
				.set({ status: "revoked", updatedAt: new Date() })
				.where(
					and(
						eq(bankOAuthTokens.bankCode, bankCode),
						eq(bankOAuthTokens.environment, environment),
						eq(bankOAuthTokens.status, "active"),
					),
				);

			// Clear cache
			const key = `${bankCode}:${environment}`;
			this.tokenCache.delete(key);

			// Clear refresh timer
			const timer = this.refreshTimers.get(key);
			if (timer) {
				clearTimeout(timer);
				this.refreshTimers.delete(key);
			}

			console.log(`[TokenMgmt] Revoked token for ${bankCode}/${environment}`);
			return true;
		} catch (error: any) {
			console.error("[TokenMgmt] Error revoking token:", error.message);
			return false;
		}
	}

	/**
	 * Get token status for monitoring
	 */
	async getTokenStatus(
		bankCode: string,
		environment: Environment,
	): Promise<{
		hasValidToken: boolean;
		expiresAt: Date | null;
		refreshCount: number;
		lastUsed: Date | null;
		circuitBreakerOpen: boolean;
	}> {
		const [stored] = await db
			.select()
			.from(bankOAuthTokens)
			.where(
				and(
					eq(bankOAuthTokens.bankCode, bankCode),
					eq(bankOAuthTokens.environment, environment),
					eq(bankOAuthTokens.status, "active"),
				),
			)
			.orderBy(desc(bankOAuthTokens.createdAt))
			.limit(1);

		const key = `${bankCode}:${environment}`;

		return {
			hasValidToken: stored ? stored.expiresAt > new Date() : false,
			expiresAt: stored?.expiresAt || null,
			refreshCount: stored?.refreshCount || 0,
			lastUsed: stored?.lastUsed || null,
			circuitBreakerOpen: this.isCircuitBreakerOpen(key),
		};
	}

	/**
	 * Cleanup expired tokens
	 */
	async cleanupExpiredTokens(): Promise<number> {
		const result = await db
			.update(bankOAuthTokens)
			.set({ status: "expired", updatedAt: new Date() })
			.where(
				and(
					eq(bankOAuthTokens.status, "active"),
					lt(bankOAuthTokens.expiresAt, new Date()),
				),
			);

		return 0; // Drizzle doesn't return affected rows count easily
	}
}

export const bankTokenManagementService = new BankTokenManagementService();
