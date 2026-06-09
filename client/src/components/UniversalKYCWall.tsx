import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
	Shield as LucideShield,
	AlertTriangle,
	CheckCircle,
	ArrowRight,
	FileText,
	Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";

interface ComplianceStatus {
	compliant: boolean;
	currentLevel: "0" | "1" | "2";
	requiredLevel: "0" | "1" | "2";
	missingRequirements: string[];
	regulatoryBasis: string[];
	guidanceMessage: string;
	roles: string[];
	redirectTo: string;
}

// Paths exempt from the KYC wall on the frontend
const EXEMPT_PATH_PREFIXES = [
	"/auth",
	"/profile",
	"/onboarding",
	"/manual-kyc",
	"/kyc",
	"/video-kyc",
	"/ca-registration",
	"/privacy",
	"/terms",
	"/refund-policy",
	"/disclaimer",
	"/proposal/",
	"/excel-addin",
];

function isExemptPath(path: string): boolean {
	return EXEMPT_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
}

function getRoleLabel(roles: string[]): string {
	if (roles.some((r) => ["master_agent"].includes(r))) return "Master Agent";
	if (roles.some((r) => ["partner"].includes(r))) return "Distribution Partner";
	if (roles.some((r) => ["agent", "sub_agent", "associate"].includes(r)))
		return "Agent";
	if (
		roles.some((r) => ["compliance_officer", "regulatory_auditor"].includes(r))
	)
		return "Compliance / Audit";
	if (roles.some((r) => ["admin", "superadmin"].includes(r)))
		return "Administrator";
	if (roles.some((r) => ["bd_head", "bd_team"].includes(r)))
		return "Business Development";
	if (roles.some((r) => ["finance_head", "finance_team"].includes(r)))
		return "Finance";
	if (roles.some((r) => ["ops_head", "ops_team"].includes(r)))
		return "Operations";
	if (
		roles.some((r) =>
			["tech_head", "tech_backend", "tech_frontend", "tech_devops"].includes(r),
		)
	)
		return "Technology";
	if (
		roles.some((r) =>
			[
				"client",
				"business_client",
				"treasury_client",
				"family_office",
				"hni",
			].includes(r),
		)
	)
		return "Client / Investor";
	return "User";
}

function getLevelLabel(level: "0" | "1" | "2"): string {
	if (level === "2") return "Full KYC (Level 2)";
	if (level === "1") return "Standard KYC (Level 1)";
	return "None";
}

export function UniversalKYCWall({ children }: { children: React.ReactNode }) {
	const { user, isLoading: authLoading } = useAuth();
	const [location, navigate] = useLocation();

	const { data: status, isLoading: kycLoading } = useQuery<ComplianceStatus>({
		queryKey: ["/api/kyc/my-compliance-status"],
		enabled: !!user && !isExemptPath(location),
		retry: false,
		staleTime: 5 * 60 * 1000, // 5 min — matches server-side cache TTL
	});

	// Not logged in, or on an exempt path, or still loading auth → show normally
	if (!user || authLoading || isExemptPath(location)) {
		return <>{children}</>;
	}

	// Loading KYC status → show nothing (avoid flash)
	if (kycLoading || !status) {
		return <>{children}</>;
	}

	// KYC is complete → let through
	if (status.compliant) {
		return <>{children}</>;
	}

	const roleLabel = getRoleLabel(status.roles);
	const requiredLabel = getLevelLabel(status.requiredLevel);
	const currentLabel = getLevelLabel(status.currentLevel);

	return (
		<div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 dark:from-gray-950 dark:to-gray-900 flex items-center justify-center p-4">
			<div className="max-w-2xl w-full space-y-6">
				{/* Header */}
				<div className="text-center space-y-3">
					<div className="flex justify-center">
						<div className="relative">
							<div className="w-20 h-20 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
								<Lock className="w-10 h-10 text-orange-600 dark:text-orange-400" />
							</div>
							<div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-red-500 flex items-center justify-center">
								<AlertTriangle className="w-4 h-4 text-white" />
							</div>
						</div>
					</div>
					<h1 className="text-2xl font-bold text-gray-900 dark:text-white">
						KYC Verification Required
					</h1>
					<p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed max-w-lg mx-auto">
						{status.guidanceMessage}
					</p>
				</div>

				{/* Status card */}
				<div className="bg-white dark:bg-gray-900 rounded-2xl border border-orange-200 dark:border-orange-800/50 shadow-sm p-6 space-y-5">
					{/* Role + level badges */}
					<div className="flex flex-wrap gap-2 items-center">
						<Badge
							variant="outline"
							className="text-xs border-blue-200 text-blue-700 dark:text-blue-400"
						>
							Role: {roleLabel}
						</Badge>
						<Badge
							variant="outline"
							className="text-xs border-gray-200 text-gray-600 dark:text-gray-400"
						>
							Current: {currentLabel}
						</Badge>
						<Badge className="text-xs bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 border-0">
							Required: {requiredLabel}
						</Badge>
					</div>

					{/* Missing requirements */}
					{status.missingRequirements.length > 0 && (
						<div className="space-y-2">
							<p className="text-sm font-medium text-gray-700 dark:text-gray-300">
								Pending verifications:
							</p>
							<ul className="space-y-2">
								{status.missingRequirements.map((item, i) => (
									<li
										key={i}
										className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400"
									>
										<div className="w-5 h-5 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center flex-shrink-0">
											<span className="text-orange-600 dark:text-orange-400 text-xs font-bold">
												{i + 1}
											</span>
										</div>
										{item}
									</li>
								))}
							</ul>
						</div>
					)}

					{/* CTA */}
					<Button
						className="w-full bg-orange-600 hover:bg-orange-700 text-white"
						onClick={() => navigate("/profile?tab=kyc-dashboard")}
					>
						Complete KYC Verification
						<ArrowRight className="ml-2 w-4 h-4" />
					</Button>
				</div>

				{/* Regulatory basis */}
				<div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-5 space-y-3">
					<div className="flex items-center gap-2">
						<FileText className="w-4 h-4 text-gray-500" />
						<p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
							Regulatory Basis
						</p>
					</div>
					<ul className="space-y-1">
						{status.regulatoryBasis.map((basis, i) => (
							<li
								key={i}
								className="flex items-start gap-2 text-xs text-gray-500 dark:text-gray-500"
							>
								<CheckCircle className="w-3 h-3 text-green-500 mt-0.5 flex-shrink-0" />
								{basis}
							</li>
						))}
					</ul>
				</div>

				{/* Footer note */}
				<p className="text-center text-xs text-gray-400 dark:text-gray-600">
					<LucideShield className="inline w-3 h-3 mr-1" />
					This requirement applies to all FintekPro users regardless of role, in
					compliance with PMLA 2002, RBI Master Direction on KYC (2016), and
					SEBI regulations.
				</p>
			</div>
		</div>
	);
}
