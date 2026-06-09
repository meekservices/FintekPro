/**
 * PII Utility functions for data masking and protection
 * Compliant with financial data privacy standards
 */

/**
 * Masks a PAN number (e.g., ABCDE1234F -> ABCDE****F)
 */
export function maskPan(pan: string | null | undefined): string {
	if (!pan) return "N/A";
	if (pan.length < 10) return pan;
	return `${pan.substring(0, 5)}****${pan.substring(9)}`;
}

/**
 * Masks a Bank Account Number (e.g., 1234567890 -> ******7890)
 */
export function maskAccountNumber(acc: string | null | undefined): string {
	if (!acc) return "N/A";
	if (acc.length < 4) return "****";
	return `${"*".repeat(acc.length - 4)}${acc.substring(acc.length - 4)}`;
}

/**
 * Masks a Mobile Number (e.g., 9876543210 -> ******3210)
 */
export function maskMobile(mobile: string | null | undefined): string {
	if (!mobile) return "N/A";
	const clean = mobile.replace(/\D/g, "");
	if (clean.length < 4) return "****";
	return `${"*".repeat(clean.length - 4)}${clean.substring(clean.length - 4)}`;
}

/**
 * Masks an Email address (e.g., john.doe@example.com -> j***e@example.com)
 */
export function maskEmail(email: string | null | undefined): string {
	if (!email) return "N/A";
	const [local, domain] = email.split("@");
	if (!domain) return "****";
	if (local.length < 3) return `*@${domain}`;
	return `${local[0]}***${local[local.length - 1]}@${domain}`;
}
