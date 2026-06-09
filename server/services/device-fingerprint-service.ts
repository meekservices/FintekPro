/**
 * Device Fingerprint Service (Task 10)
 *
 * Captures and logs device fingerprints during KYC for security audit
 * PMLA/AML compliant device tracking
 */

import crypto from "crypto";

interface DeviceFingerprint {
	fingerprintId: string;
	userId: string;
	sessionId: string;
	userAgent: string;
	ip: string;
	geoLocation?: {
		country?: string;
		region?: string;
		city?: string;
		timezone?: string;
	};
	screenResolution?: string;
	language?: string;
	platform?: string;
	vendor?: string;
	cookiesEnabled?: boolean;
	doNotTrack?: boolean;
	hardwareConcurrency?: number;
	deviceMemory?: number;
	colorDepth?: number;
	touchSupport?: boolean;
	webglRenderer?: string;
	canvasHash?: string;
	createdAt: Date;
	action:
		| "kyc_start"
		| "pan_verify"
		| "aadhaar_otp"
		| "aadhaar_verify"
		| "compliance_signoff"
		| "login"
		| "transaction";
}

interface GeoIPResponse {
	country?: string;
	region?: string;
	city?: string;
	timezone?: string;
}

class DeviceFingerprintService {
	private fingerprints: Map<string, DeviceFingerprint[]> = new Map();

	/**
	 * Generate device fingerprint from request headers and client data
	 */
	generateFingerprint(
		userId: string,
		sessionId: string,
		req: any,
		clientData?: Partial<DeviceFingerprint>,
		action: DeviceFingerprint["action"] = "kyc_start",
	): DeviceFingerprint {
		const userAgent = req.headers["user-agent"] || "unknown";
		const ip = this.extractIP(req);

		const fingerprintData = {
			userId,
			sessionId,
			userAgent,
			ip,
			platform: clientData?.platform || this.extractPlatform(userAgent),
			language: req.headers["accept-language"]?.split(",")[0] || "unknown",
			action,
			createdAt: new Date(),
			screenResolution: clientData?.screenResolution,
			vendor: clientData?.vendor,
			cookiesEnabled: clientData?.cookiesEnabled,
			doNotTrack: req.headers.dnt === "1",
			hardwareConcurrency: clientData?.hardwareConcurrency,
			deviceMemory: clientData?.deviceMemory,
			colorDepth: clientData?.colorDepth,
			touchSupport: clientData?.touchSupport,
			webglRenderer: clientData?.webglRenderer,
			canvasHash: clientData?.canvasHash,
		};

		const fingerprintId = this.generateHash(fingerprintData);

		const fingerprint: DeviceFingerprint = {
			...fingerprintData,
			fingerprintId,
		};

		// Store fingerprint
		this.storeFingerprint(userId, fingerprint);

		console.log(
			`🔐 [Device Fingerprint] Captured for user ${userId.substring(0, 8)}...: ${fingerprintId.substring(0, 8)}... | Action: ${action}`,
		);

		return fingerprint;
	}

	/**
	 * Store fingerprint for user
	 */
	private storeFingerprint(
		userId: string,
		fingerprint: DeviceFingerprint,
	): void {
		const existing = this.fingerprints.get(userId) || [];
		existing.push(fingerprint);

		// Keep last 100 fingerprints per user
		if (existing.length > 100) {
			existing.shift();
		}

		this.fingerprints.set(userId, existing);
	}

	/**
	 * Get user's fingerprint history
	 */
	getUserFingerprints(userId: string): DeviceFingerprint[] {
		return this.fingerprints.get(userId) || [];
	}

	/**
	 * Check if device fingerprint is suspicious (new device)
	 */
	isNewDevice(userId: string, currentFingerprint: DeviceFingerprint): boolean {
		const history = this.fingerprints.get(userId) || [];
		if (history.length === 0) return true;

		return !history.some(
			(fp) =>
				fp.fingerprintId === currentFingerprint.fingerprintId ||
				(fp.userAgent === currentFingerprint.userAgent &&
					fp.platform === currentFingerprint.platform),
		);
	}

	/**
	 * Detect potentially fraudulent patterns
	 */
	detectSuspiciousPatterns(userId: string): {
		isSuspicious: boolean;
		reasons: string[];
		riskScore: number;
	} {
		const history = this.fingerprints.get(userId) || [];
		const reasons: string[] = [];
		let riskScore = 0;

		if (history.length < 2) {
			return { isSuspicious: false, reasons: [], riskScore: 0 };
		}

		// Check for multiple IPs in short time
		const recentFingerprints = history.filter(
			(fp) => Date.now() - fp.createdAt.getTime() < 60 * 60 * 1000, // Last hour
		);

		const uniqueIPs = new Set(recentFingerprints.map((fp) => fp.ip));
		if (uniqueIPs.size > 3) {
			reasons.push(`Multiple IPs detected (${uniqueIPs.size}) in last hour`);
			riskScore += 30;
		}

		// Check for multiple user agents
		const uniqueAgents = new Set(recentFingerprints.map((fp) => fp.userAgent));
		if (uniqueAgents.size > 2) {
			reasons.push(`Multiple devices/browsers detected (${uniqueAgents.size})`);
			riskScore += 20;
		}

		// Check for VPN/Proxy indicators
		const vpnIndicators = recentFingerprints.filter(
			(fp) => fp.ip?.startsWith("10.") || fp.ip?.startsWith("192.168."),
		);
		if (vpnIndicators.length > 0 && uniqueIPs.size > 1) {
			reasons.push("Possible VPN/Proxy usage detected");
			riskScore += 15;
		}

		// Check for automation indicators
		const automationIndicators = recentFingerprints.filter(
			(fp) =>
				fp.userAgent?.includes("bot") ||
				fp.userAgent?.includes("headless") ||
				fp.userAgent?.includes("phantom"),
		);
		if (automationIndicators.length > 0) {
			reasons.push("Automation tool indicators detected");
			riskScore += 40;
		}

		return {
			isSuspicious: riskScore >= 30,
			reasons,
			riskScore: Math.min(riskScore, 100),
		};
	}

	/**
	 * Get audit log for compliance
	 */
	getAuditLog(
		userId: string,
		fromDate?: Date,
		toDate?: Date,
	): DeviceFingerprint[] {
		const history = this.fingerprints.get(userId) || [];

		return history.filter((fp) => {
			if (fromDate && fp.createdAt < fromDate) return false;
			if (toDate && fp.createdAt > toDate) return false;
			return true;
		});
	}

	/**
	 * Export fingerprints for compliance reporting
	 */
	exportForCompliance(userId: string): {
		userId: string;
		totalFingerprints: number;
		uniqueDevices: number;
		uniqueIPs: number;
		firstSeen: Date | null;
		lastSeen: Date | null;
		fingerprints: DeviceFingerprint[];
	} {
		const history = this.fingerprints.get(userId) || [];
		const uniqueDevices = new Set(history.map((fp) => fp.fingerprintId)).size;
		const uniqueIPs = new Set(history.map((fp) => fp.ip)).size;

		return {
			userId,
			totalFingerprints: history.length,
			uniqueDevices,
			uniqueIPs,
			firstSeen: history.length > 0 ? history[0].createdAt : null,
			lastSeen:
				history.length > 0 ? history[history.length - 1].createdAt : null,
			fingerprints: history,
		};
	}

	private extractIP(req: any): string {
		return (
			req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
			req.headers["x-real-ip"] ||
			req.connection?.remoteAddress ||
			req.socket?.remoteAddress ||
			"unknown"
		);
	}

	private extractPlatform(userAgent: string): string {
		if (userAgent.includes("Windows")) return "Windows";
		if (userAgent.includes("Mac")) return "macOS";
		if (userAgent.includes("Linux")) return "Linux";
		if (userAgent.includes("Android")) return "Android";
		if (userAgent.includes("iPhone") || userAgent.includes("iPad"))
			return "iOS";
		return "Unknown";
	}

	private generateHash(data: any): string {
		const str = JSON.stringify({
			userAgent: data.userAgent,
			platform: data.platform,
			screenResolution: data.screenResolution,
			language: data.language,
			hardwareConcurrency: data.hardwareConcurrency,
			colorDepth: data.colorDepth,
			canvasHash: data.canvasHash,
		});
		return crypto.createHash("sha256").update(str).digest("hex");
	}
}

export const deviceFingerprintService = new DeviceFingerprintService();
export type { DeviceFingerprint };
