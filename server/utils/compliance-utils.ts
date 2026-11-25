/**
 * Regulatory Compliance Utilities
 * Implements guards for SEBI/RBI/Income Tax standards
 */

import { complianceMonitor } from "../compliance-monitor";

export const REGULATORY_DISCLAIMER =
	"Investment recommendations are AI-generated and for informational purposes only. Past performance does not guarantee future results. Investors should conduct independent due diligence and consult a SEBI-registered investment advisor before making investment decisions. FintekPro does not guarantee accuracy of third-party data. Data sourced from NSE, BSE, AMFI, Alpha Vantage, and Yahoo Finance.";

// Regulatory thresholds for transaction monitoring (e.g., PAN requirement, TDS, high-value reporting)
export const REGULATORY_THRESHOLDS = {
	PAN_REQUIREMENT: 50000,
	HIGH_VALUE_TRANSACTION: 200000,
	AUDIT_TRIGGER: 500000,
};

// Threshold margin for "nearly equal" values (smurfing protection)
const SUSPICIOUS_MARGIN = 500;

/**
 * Checks if an amount is suspiciously close to a regulatory threshold.
 * Used to flag potential attempts to bypass reporting requirements (Smurfing).
 */
export function checkSuspiciousValues(amount: number): {
	isSuspicious: boolean;
	threshold?: number;
	reason?: string;
} {
	const thresholds = Object.values(REGULATORY_THRESHOLDS);

	for (const threshold of thresholds) {
		if (Math.abs(amount - threshold) <= SUSPICIOUS_MARGIN) {
			return {
				isSuspicious: true,
				threshold,
				reason: `Value ₹${amount} is suspiciously close to the regulatory threshold of ₹${threshold}.`,
			};
		}
	}

	return { isSuspicious: false };
}

/**
 * Logs suspicious financial activity to the compliance monitor
 */
export async function logSuspiciousTransaction(
	userId: string,
	amount: number,
	resource: string,
	details: any,
) {
	const { isSuspicious, threshold, reason } = checkSuspiciousValues(amount);

	if (isSuspicious) {
		await complianceMonitor.logSuspiciousActivity({
			userId,
			activityType: "SUSPICIOUS_TRANSACTION_VALUE",
			details:
				reason || `Suspicious value ₹${amount} near threshold ₹${threshold}`,
			severity: "medium",
			metadata: {
				amount,
				nearThreshold: threshold,
				resource,
				...details,
			},
		});
		return true;
	}

	return false;
}
