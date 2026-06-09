import { useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

export type ComplianceErrorCode =
	| "KYC_LEVEL_INSUFFICIENT"
	| "KYC_NOT_VERIFIED"
	| "DEMAT_NOT_LINKED"
	| "DEMAT_INVALID"
	| "RISK_PROFILE_MISSING"
	| "RISK_PROFILE_MISMATCH"
	| "PAN_NOT_VERIFIED"
	| "BANK_NOT_LINKED"
	| "ACCREDITED_INVESTOR_REQUIRED"
	| "PRODUCT_NOT_ELIGIBLE"
	| "INSUFFICIENT_BALANCE"
	| "ORDER_LIMIT_EXCEEDED"
	| "MARKET_CLOSED"
	| "SECURITY_NOT_AVAILABLE"
	| "COMPLIANCE_CHECK_FAILED"
	| "GENERIC_ERROR";

export interface ComplianceRemediation {
	type: "navigate" | "action" | "info";
	targetRoute?: string;
	ctaLabel: string;
	ctaVariant?: "default" | "destructive" | "outline" | "secondary";
}

export interface ComplianceError {
	code: ComplianceErrorCode;
	message: string;
	details?: string;
	remediation: ComplianceRemediation;
	severity: "warning" | "error" | "info";
	requiredKycTier?: string;
	currentKycTier?: string;
	missingSteps?: string[];
	productRequirements?: Record<string, any>;
	backendMessage?: string;
	backendRemediation?: {
		targetRoute?: string;
		ctaLabel?: string;
	};
}

const ERROR_MAPPING: Record<
	ComplianceErrorCode,
	Omit<
		ComplianceError,
		| "code"
		| "details"
		| "requiredKycTier"
		| "currentKycTier"
		| "missingSteps"
		| "productRequirements"
		| "backendMessage"
		| "backendRemediation"
	>
> = {
	KYC_LEVEL_INSUFFICIENT: {
		message: "Your KYC level is insufficient for this product",
		severity: "warning",
		remediation: {
			type: "navigate",
			targetRoute: "/kyc-dashboard",
			ctaLabel: "Upgrade KYC",
			ctaVariant: "default",
		},
	},
	KYC_NOT_VERIFIED: {
		message: "Please complete your KYC verification to place orders",
		severity: "warning",
		remediation: {
			type: "navigate",
			targetRoute: "/kyc-dashboard",
			ctaLabel: "Complete KYC",
			ctaVariant: "default",
		},
	},
	DEMAT_NOT_LINKED: {
		message: "A Demat account is required to hold securities",
		severity: "warning",
		remediation: {
			type: "navigate",
			targetRoute: "/kyc-dashboard?step=demat",
			ctaLabel: "Link Demat Account",
			ctaVariant: "default",
		},
	},
	DEMAT_INVALID: {
		message: "Your linked Demat account could not be verified",
		severity: "error",
		remediation: {
			type: "navigate",
			targetRoute: "/kyc-dashboard?step=demat",
			ctaLabel: "Update Demat Details",
			ctaVariant: "default",
		},
	},
	RISK_PROFILE_MISSING: {
		message: "Please complete your risk assessment before investing",
		severity: "warning",
		remediation: {
			type: "navigate",
			targetRoute: "/kyc-dashboard?step=risk",
			ctaLabel: "Complete Risk Assessment",
			ctaVariant: "default",
		},
	},
	RISK_PROFILE_MISMATCH: {
		message: "This product does not match your risk profile",
		severity: "warning",
		remediation: {
			type: "navigate",
			targetRoute: "/kyc-dashboard?step=risk",
			ctaLabel: "Review Risk Profile",
			ctaVariant: "outline",
		},
	},
	PAN_NOT_VERIFIED: {
		message: "PAN verification is required for trading",
		severity: "warning",
		remediation: {
			type: "navigate",
			targetRoute: "/kyc-dashboard?step=pan",
			ctaLabel: "Verify PAN",
			ctaVariant: "default",
		},
	},
	BANK_NOT_LINKED: {
		message: "Please link a bank account for settlements",
		severity: "warning",
		remediation: {
			type: "navigate",
			targetRoute: "/kyc-dashboard?step=bank",
			ctaLabel: "Link Bank Account",
			ctaVariant: "default",
		},
	},
	ACCREDITED_INVESTOR_REQUIRED: {
		message: "This product is only available to accredited investors",
		severity: "error",
		remediation: {
			type: "navigate",
			targetRoute: "/kyc-dashboard",
			ctaLabel: "Check Eligibility",
			ctaVariant: "outline",
		},
	},
	PRODUCT_NOT_ELIGIBLE: {
		message: "You are not eligible for this product",
		severity: "error",
		remediation: {
			type: "navigate",
			targetRoute: "/kyc-dashboard",
			ctaLabel: "View Requirements",
			ctaVariant: "outline",
		},
	},
	INSUFFICIENT_BALANCE: {
		message: "Insufficient funds for this order",
		severity: "error",
		remediation: {
			type: "info",
			ctaLabel: "Add Funds",
			ctaVariant: "default",
		},
	},
	ORDER_LIMIT_EXCEEDED: {
		message: "Order amount exceeds your daily limit",
		severity: "warning",
		remediation: {
			type: "navigate",
			targetRoute: "/kyc-dashboard",
			ctaLabel: "Increase Limit",
			ctaVariant: "outline",
		},
	},
	MARKET_CLOSED: {
		message: "Market is currently closed",
		severity: "info",
		remediation: {
			type: "info",
			ctaLabel: "View Market Hours",
			ctaVariant: "outline",
		},
	},
	SECURITY_NOT_AVAILABLE: {
		message: "This security is not available for trading",
		severity: "error",
		remediation: {
			type: "info",
			ctaLabel: "Browse Other Securities",
			ctaVariant: "outline",
		},
	},
	COMPLIANCE_CHECK_FAILED: {
		message: "Compliance verification failed",
		severity: "error",
		remediation: {
			type: "navigate",
			targetRoute: "/kyc-dashboard",
			ctaLabel: "Review Compliance",
			ctaVariant: "default",
		},
	},
	GENERIC_ERROR: {
		message: "Something went wrong. Please try again.",
		severity: "error",
		remediation: {
			type: "info",
			ctaLabel: "Try Again",
			ctaVariant: "outline",
		},
	},
};

export function parseComplianceError(error: any): ComplianceError {
	let errorCode: ComplianceErrorCode = "GENERIC_ERROR";
	let errorDetails: string | undefined;
	let errorMessage: string | undefined;
	let requiredKycTier: string | undefined;
	let currentKycTier: string | undefined;
	let missingSteps: string[] | undefined;
	let productRequirements: Record<string, any> | undefined;
	let backendMessage: string | undefined;
	let backendRemediation:
		| { targetRoute?: string; ctaLabel?: string }
		| undefined;

	if (error?.response?.data) {
		const data = error.response.data;
		errorCode = data.code || data.errorCode || "GENERIC_ERROR";
		errorDetails = data.details || data.reason || data.message;
		errorMessage = data.message;
		backendMessage = data.message;

		requiredKycTier =
			data.requiredKycTier || data.required_kyc_tier || data.requiredTier;
		currentKycTier =
			data.currentKycTier || data.current_kyc_tier || data.currentTier;
		missingSteps = data.missingSteps || data.missing_steps || data.pendingSteps;
		productRequirements = data.productRequirements || data.requirements;

		if (data.remediation) {
			backendRemediation = {
				targetRoute:
					data.remediation.targetRoute ||
					data.remediation.route ||
					data.remediation.path,
				ctaLabel:
					data.remediation.ctaLabel ||
					data.remediation.cta ||
					data.remediation.label,
			};
		}

		if (data.compliance) {
			requiredKycTier = requiredKycTier || data.compliance.requiredTier;
			currentKycTier = currentKycTier || data.compliance.currentTier;
			missingSteps = missingSteps || data.compliance.missingSteps;
		}
	} else if (error?.message) {
		errorMessage = error.message;
		errorDetails = error.message;
		backendMessage = error.message;

		const message = error.message.toLowerCase();
		if (
			message.includes("kyc") &&
			(message.includes("level") ||
				message.includes("insufficient") ||
				message.includes("tier"))
		) {
			errorCode = "KYC_LEVEL_INSUFFICIENT";
			const tierMatch = error.message.match(
				/requires?\s+(\w+)\s+(?:tier|kyc|level)/i,
			);
			if (tierMatch) requiredKycTier = tierMatch[1];
			const currentMatch = error.message.match(
				/current(?:ly)?\s+(?:at\s+)?(\w+)\s+(?:tier|kyc|level)/i,
			);
			if (currentMatch) currentKycTier = currentMatch[1];
		} else if (
			message.includes("kyc") &&
			(message.includes("verify") || message.includes("complete"))
		) {
			errorCode = "KYC_NOT_VERIFIED";
		} else if (
			message.includes("demat") &&
			(message.includes("link") ||
				message.includes("required") ||
				message.includes("missing"))
		) {
			errorCode = "DEMAT_NOT_LINKED";
			missingSteps = missingSteps || ["Demat Account"];
		} else if (
			message.includes("demat") &&
			(message.includes("invalid") || message.includes("verify"))
		) {
			errorCode = "DEMAT_INVALID";
		} else if (
			message.includes("risk") &&
			(message.includes("profile") || message.includes("assessment"))
		) {
			errorCode = message.includes("mismatch")
				? "RISK_PROFILE_MISMATCH"
				: "RISK_PROFILE_MISSING";
			missingSteps = missingSteps || ["Risk Profile"];
		} else if (
			message.includes("pan") &&
			(message.includes("verify") || message.includes("required"))
		) {
			errorCode = "PAN_NOT_VERIFIED";
			missingSteps = missingSteps || ["PAN Verification"];
		} else if (
			message.includes("bank") &&
			(message.includes("link") || message.includes("required"))
		) {
			errorCode = "BANK_NOT_LINKED";
			missingSteps = missingSteps || ["Bank Account"];
		} else if (
			message.includes("accredited") ||
			message.includes("qualified investor")
		) {
			errorCode = "ACCREDITED_INVESTOR_REQUIRED";
			requiredKycTier = requiredKycTier || "Accredited";
		} else if (
			message.includes("eligible") ||
			message.includes("eligibility")
		) {
			errorCode = "PRODUCT_NOT_ELIGIBLE";
		} else if (message.includes("balance") || message.includes("funds")) {
			errorCode = "INSUFFICIENT_BALANCE";
		} else if (message.includes("limit") && message.includes("exceed")) {
			errorCode = "ORDER_LIMIT_EXCEEDED";
		} else if (message.includes("market") && message.includes("closed")) {
			errorCode = "MARKET_CLOSED";
		} else if (message.includes("compliance")) {
			errorCode = "COMPLIANCE_CHECK_FAILED";
		}
	}

	const mapping = ERROR_MAPPING[errorCode] || ERROR_MAPPING.GENERIC_ERROR;

	const finalRemediation = { ...mapping.remediation };
	if (backendRemediation?.targetRoute) {
		finalRemediation.targetRoute = backendRemediation.targetRoute;
	}
	if (backendRemediation?.ctaLabel) {
		finalRemediation.ctaLabel = backendRemediation.ctaLabel;
	}

	return {
		code: errorCode,
		message: backendMessage || errorMessage || mapping.message,
		details: errorDetails,
		severity: mapping.severity,
		remediation: finalRemediation,
		requiredKycTier,
		currentKycTier,
		missingSteps,
		productRequirements,
		backendMessage,
		backendRemediation,
	};
}

export interface UseOrderGuardReturn {
	error: ComplianceError | null;
	setError: (error: ComplianceError | null) => void;
	handleError: (error: any, showToast?: boolean) => ComplianceError;
	clearError: () => void;
	navigateToRemediation: () => void;
	isBlocked: boolean;
}

export function useOrderGuard(): UseOrderGuardReturn {
	const [error, setError] = useState<ComplianceError | null>(null);
	const [, navigate] = useLocation();
	const { toast } = useToast();

	const handleError = useCallback(
		(rawError: any, showToast: boolean = true): ComplianceError => {
			const parsedError = parseComplianceError(rawError);
			setError(parsedError);

			if (showToast) {
				toast({
					variant: parsedError.severity === "error" ? "destructive" : "default",
					title:
						parsedError.severity === "error"
							? "Order Failed"
							: "Action Required",
					description: parsedError.message,
				});
			}

			return parsedError;
		},
		[toast],
	);

	const clearError = useCallback(() => {
		setError(null);
	}, []);

	const navigateToRemediation = useCallback(() => {
		if (
			error?.remediation.type === "navigate" &&
			error.remediation.targetRoute
		) {
			setError(null);
			navigate(error.remediation.targetRoute);
		}
	}, [error, navigate]);

	return {
		error,
		setError,
		handleError,
		clearError,
		navigateToRemediation,
		isBlocked: error !== null,
	};
}
