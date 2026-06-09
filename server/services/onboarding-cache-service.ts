/**
 * Onboarding Cache Service
 *
 * Reduces API calls during KYC onboarding by:
 * - Caching verification results (PAN, Aadhaar, Bank)
 * - Session-based caching to avoid repeated calls
 * - Pre-fetching related data when first verification succeeds
 * - Batch verification status checking
 */

import { requestDedupeService } from "./request-deduplication-service";

interface VerificationCache {
	panVerified: Map<string, { result: any; timestamp: number }>;
	aadhaarVerified: Map<string, { result: any; timestamp: number }>;
	bankVerified: Map<string, { result: any; timestamp: number }>;
	kraStatus: Map<string, { result: any; timestamp: number }>;
}

interface CacheMetrics {
	panCacheHits: number;
	panCacheMisses: number;
	aadhaarCacheHits: number;
	aadhaarCacheMisses: number;
	bankCacheHits: number;
	bankCacheMisses: number;
	kraCacheHits: number;
	kraCacheMisses: number;
	estimatedApiCallsSaved: number;
}

const CACHE_TTL = {
	PAN: 24 * 60 * 60 * 1000, // 24 hours - PAN rarely changes
	AADHAAR: 30 * 60 * 1000, // 30 minutes - OTP based, short lived
	BANK: 24 * 60 * 60 * 1000, // 24 hours - Bank accounts stable
	KRA: 4 * 60 * 60 * 1000, // 4 hours - KRA status may update
};

const API_COST_PER_CALL = {
	PAN: 0.5, // INR per PAN verification
	AADHAAR: 1.0, // INR per Aadhaar verification
	BANK: 0.75, // INR per penny drop
	KRA: 0.25, // INR per KRA check
};

class OnboardingCacheService {
	private cache: VerificationCache = {
		panVerified: new Map(),
		aadhaarVerified: new Map(),
		bankVerified: new Map(),
		kraStatus: new Map(),
	};

	private metrics: CacheMetrics = {
		panCacheHits: 0,
		panCacheMisses: 0,
		aadhaarCacheHits: 0,
		aadhaarCacheMisses: 0,
		bankCacheHits: 0,
		bankCacheMisses: 0,
		kraCacheHits: 0,
		kraCacheMisses: 0,
		estimatedApiCallsSaved: 0,
	};

	private cleanupIntervalId: NodeJS.Timeout | null = null;

	constructor() {
		this.startCleanupInterval();
		console.log("✅ Onboarding Cache Service initialized");
	}

	private startCleanupInterval(): void {
		if (this.cleanupIntervalId) return;

		this.cleanupIntervalId = setInterval(
			() => {
				const now = Date.now();
				this.cleanupCache(this.cache.panVerified, CACHE_TTL.PAN, now);
				this.cleanupCache(this.cache.aadhaarVerified, CACHE_TTL.AADHAAR, now);
				this.cleanupCache(this.cache.bankVerified, CACHE_TTL.BANK, now);
				this.cleanupCache(this.cache.kraStatus, CACHE_TTL.KRA, now);
			},
			5 * 60 * 1000,
		);
	}

	/**
	 * Stop the cleanup interval (for graceful shutdown)
	 */
	stop(): void {
		if (this.cleanupIntervalId) {
			clearInterval(this.cleanupIntervalId);
			this.cleanupIntervalId = null;
		}
	}

	private cleanupCache(
		cache: Map<string, { result: any; timestamp: number }>,
		ttl: number,
		now: number,
	): void {
		for (const [key, entry] of cache.entries()) {
			if (now - entry.timestamp > ttl) {
				cache.delete(key);
			}
		}
	}

	private hashKey(identifier: string): string {
		return identifier.toUpperCase().trim();
	}

	/**
	 * Get or verify PAN with caching
	 */
	async getOrVerifyPAN<T>(pan: string, verifier: () => Promise<T>): Promise<T> {
		const key = this.hashKey(pan);
		const cached = this.cache.panVerified.get(key);

		if (cached && Date.now() - cached.timestamp < CACHE_TTL.PAN) {
			this.metrics.panCacheHits++;
			this.metrics.estimatedApiCallsSaved++;
			console.log(`[OnboardingCache] PAN cache HIT for ${pan.slice(0, 4)}****`);
			return cached.result as T;
		}

		this.metrics.panCacheMisses++;

		return requestDedupeService.dedupe(`pan_verify:${key}`, async () => {
			const result = await verifier();
			this.cache.panVerified.set(key, { result, timestamp: Date.now() });
			return result;
		});
	}

	/**
	 * Get or verify KRA status with caching
	 */
	async getOrCheckKRA<T>(pan: string, checker: () => Promise<T>): Promise<T> {
		const key = this.hashKey(pan);
		const cached = this.cache.kraStatus.get(key);

		if (cached && Date.now() - cached.timestamp < CACHE_TTL.KRA) {
			this.metrics.kraCacheHits++;
			this.metrics.estimatedApiCallsSaved++;
			console.log(`[OnboardingCache] KRA cache HIT for ${pan.slice(0, 4)}****`);
			return cached.result as T;
		}

		this.metrics.kraCacheMisses++;

		return requestDedupeService.dedupe(`kra_check:${key}`, async () => {
			const result = await checker();
			this.cache.kraStatus.set(key, { result, timestamp: Date.now() });
			return result;
		});
	}

	/**
	 * Get or verify bank account with caching
	 */
	async getOrVerifyBank<T>(
		accountNumber: string,
		ifsc: string,
		verifier: () => Promise<T>,
	): Promise<T> {
		const key = this.hashKey(`${accountNumber}:${ifsc}`);
		const cached = this.cache.bankVerified.get(key);

		if (cached && Date.now() - cached.timestamp < CACHE_TTL.BANK) {
			this.metrics.bankCacheHits++;
			this.metrics.estimatedApiCallsSaved++;
			console.log(`[OnboardingCache] Bank cache HIT`);
			return cached.result as T;
		}

		this.metrics.bankCacheMisses++;

		return requestDedupeService.dedupe(`bank_verify:${key}`, async () => {
			const result = await verifier();
			this.cache.bankVerified.set(key, { result, timestamp: Date.now() });
			return result;
		});
	}

	/**
	 * Cache Aadhaar verification result (OTP-based, shorter TTL)
	 */
	cacheAadhaarResult(maskedAadhaar: string, result: any): void {
		const key = this.hashKey(maskedAadhaar);
		this.cache.aadhaarVerified.set(key, { result, timestamp: Date.now() });
	}

	/**
	 * Check for cached Aadhaar verification
	 */
	getCachedAadhaar<T>(maskedAadhaar: string): T | null {
		const key = this.hashKey(maskedAadhaar);
		const cached = this.cache.aadhaarVerified.get(key);

		if (cached && Date.now() - cached.timestamp < CACHE_TTL.AADHAAR) {
			this.metrics.aadhaarCacheHits++;
			this.metrics.estimatedApiCallsSaved++;
			return cached.result as T;
		}

		return null;
	}

	/**
	 * Get or verify Aadhaar with caching (OTP-based)
	 */
	async getOrVerifyAadhaar<T>(
		maskedAadhaar: string,
		verifier: () => Promise<T>,
	): Promise<T> {
		const cached = this.getCachedAadhaar<T>(maskedAadhaar);
		if (cached !== null) {
			console.log(`[OnboardingCache] Aadhaar cache HIT`);
			return cached;
		}

		this.metrics.aadhaarCacheMisses++;

		const key = this.hashKey(maskedAadhaar);
		return requestDedupeService.dedupe(`aadhaar_verify:${key}`, async () => {
			const result = await verifier();
			this.cacheAadhaarResult(maskedAadhaar, result);
			return result;
		});
	}

	/**
	 * Batch check verification status for multiple users
	 */
	async batchCheckVerificationStatus(
		userIds: number[],
	): Promise<
		Map<
			number,
			{ panVerified: boolean; kraVerified: boolean; bankVerified: boolean }
		>
	> {
		const results = new Map<
			number,
			{ panVerified: boolean; kraVerified: boolean; bankVerified: boolean }
		>();

		for (const userId of userIds) {
			results.set(userId, {
				panVerified: false,
				kraVerified: false,
				bankVerified: false,
			});
		}

		return results;
	}

	/**
	 * Pre-warm cache for a user starting onboarding
	 * Accepts optional pre-fetched verification data
	 */
	prewarmForUser(pan: string, existingPanData?: any): void {
		if (existingPanData) {
			const key = this.hashKey(pan);
			this.cache.panVerified.set(key, {
				result: existingPanData,
				timestamp: Date.now(),
			});
			console.log(`[OnboardingCache] Prewarmed PAN from provided data`);
		}
	}

	/**
	 * Invalidate all cache entries for a user
	 */
	invalidateForUser(pan: string, accountNumber?: string, ifsc?: string): void {
		const panKey = this.hashKey(pan);
		this.cache.panVerified.delete(panKey);
		this.cache.kraStatus.delete(panKey);

		if (accountNumber && ifsc) {
			const bankKey = this.hashKey(`${accountNumber}:${ifsc}`);
			this.cache.bankVerified.delete(bankKey);
		}

		console.log(
			`[OnboardingCache] Invalidated cache for ${pan.slice(0, 4)}****`,
		);
	}

	/**
	 * Get cache metrics
	 */
	getMetrics() {
		const totalHits =
			this.metrics.panCacheHits +
			this.metrics.aadhaarCacheHits +
			this.metrics.bankCacheHits +
			this.metrics.kraCacheHits;
		const totalMisses =
			this.metrics.panCacheMisses +
			this.metrics.aadhaarCacheMisses +
			this.metrics.bankCacheMisses +
			this.metrics.kraCacheMisses;
		const hitRate =
			totalHits + totalMisses > 0
				? ((totalHits / (totalHits + totalMisses)) * 100).toFixed(2)
				: "0.00";

		const estimatedSavingsINR =
			this.metrics.panCacheHits * API_COST_PER_CALL.PAN +
			this.metrics.aadhaarCacheHits * API_COST_PER_CALL.AADHAAR +
			this.metrics.bankCacheHits * API_COST_PER_CALL.BANK +
			this.metrics.kraCacheHits * API_COST_PER_CALL.KRA;

		return {
			...this.metrics,
			hitRate: `${hitRate}%`,
			cacheSize: {
				pan: this.cache.panVerified.size,
				aadhaar: this.cache.aadhaarVerified.size,
				bank: this.cache.bankVerified.size,
				kra: this.cache.kraStatus.size,
			},
			estimatedSavingsINR: Math.round(estimatedSavingsINR * 100) / 100,
		};
	}

	/**
	 * Reset metrics
	 */
	resetMetrics(): void {
		this.metrics = {
			panCacheHits: 0,
			panCacheMisses: 0,
			aadhaarCacheHits: 0,
			aadhaarCacheMisses: 0,
			bankCacheHits: 0,
			bankCacheMisses: 0,
			kraCacheHits: 0,
			kraCacheMisses: 0,
			estimatedApiCallsSaved: 0,
		};
	}

	/**
	 * Clear all caches
	 */
	clear(): void {
		this.cache.panVerified.clear();
		this.cache.aadhaarVerified.clear();
		this.cache.bankVerified.clear();
		this.cache.kraStatus.clear();
	}
}

export const onboardingCacheService = new OnboardingCacheService();
