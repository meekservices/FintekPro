import { useState, useEffect } from "react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Shield as LucideShield,
	Cookie,
	Database,
	Mail,
	Users,
} from "lucide-react";
import { Link } from "wouter";

interface ConsentPreferences {
	essential: boolean;
	analytics: boolean;
	marketing: boolean;
	dataProcessing: boolean;
}

export function GDPRConsent() {
	const [isOpen, setIsOpen] = useState(false);
	const [showDetails, setShowDetails] = useState(false);
	const [preferences, setPreferences] = useState<ConsentPreferences>({
		essential: true, // Always required
		analytics: false,
		marketing: false,
		dataProcessing: false,
	});

	useEffect(() => {
		// Check if user has already given consent
		const hasConsent = localStorage.getItem("gdpr-consent");
		if (!hasConsent) {
			setIsOpen(true);
		}
	}, []);

	const handleAcceptAll = () => {
		const allConsent = {
			essential: true,
			analytics: true,
			marketing: true,
			dataProcessing: true,
		};

		saveConsentPreferences(allConsent);
		setIsOpen(false);
	};

	const handleAcceptSelected = () => {
		saveConsentPreferences(preferences);
		setIsOpen(false);
	};

	const handleRejectNonEssential = () => {
		const essentialOnly = {
			essential: true,
			analytics: false,
			marketing: false,
			dataProcessing: false,
		};

		saveConsentPreferences(essentialOnly);
		setIsOpen(false);
	};

	const saveConsentPreferences = (prefs: ConsentPreferences) => {
		const consentData = {
			preferences: prefs,
			timestamp: new Date().toISOString(),
			version: "1.0",
		};

		localStorage.setItem("gdpr-consent", JSON.stringify(consentData));

		// Send to backend for audit trail
		fetch("/api/consent", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(consentData),
		}).catch(console.error);
	};

	const updatePreference = (key: keyof ConsentPreferences, value: boolean) => {
		setPreferences((prev) => ({
			...prev,
			[key]: value,
		}));
	};

	if (!isOpen) return null;

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			<DialogContent
				className="max-w-4xl max-h-[90vh] overflow-y-auto"
				data-testid="gdpr-consent-dialog"
			>
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2 text-xl">
						<LucideShield className="w-6 h-6 text-blue-600" />
						Your Privacy Matters
					</DialogTitle>
					<DialogDescription className="text-base">
						We use cookies and collect data to provide you with the best
						financial services experience. Please review and customize your
						privacy preferences.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-6">
					{!showDetails ? (
						<div className="space-y-4">
							<div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
								<h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
									We respect your privacy and follow GDPR guidelines
								</h3>
								<p className="text-blue-700 dark:text-blue-300 text-sm">
									Our platform processes financial data to provide investment
									services, comply with regulations, and improve your
									experience. You can customize your preferences below.
								</p>
							</div>

							<div className="flex flex-wrap gap-3">
								<Button
									onClick={handleAcceptAll}
									className="bg-blue-600 hover:bg-blue-700"
									data-testid="accept-all-button"
								>
									Accept All
								</Button>
								<Button
									onClick={handleRejectNonEssential}
									variant="outline"
									data-testid="reject-non-essential-button"
								>
									Essential Only
								</Button>
								<Button
									onClick={() => setShowDetails(true)}
									variant="outline"
									data-testid="customize-button"
								>
									Customize Preferences
								</Button>
							</div>

							<p className="text-xs text-muted-foreground">
								By continuing, you agree to our{" "}
								<Link href="/privacy" className="text-blue-600 hover:underline">
									Privacy Policy
								</Link>{" "}
								and{" "}
								<Link href="/terms" className="text-blue-600 hover:underline">
									Terms of Service
								</Link>
							</p>
						</div>
					) : (
						<div className="space-y-4">
							<div className="grid gap-4">
								<Card>
									<CardHeader className="pb-3">
										<CardTitle className="flex items-center gap-2 text-lg">
											<LucideShield className="w-5 h-5 text-green-600" />
											Essential Services
										</CardTitle>
									</CardHeader>
									<CardContent>
										<div className="flex items-start justify-between">
											<div className="flex-1">
												<p className="text-sm text-muted-foreground mb-2">
													Required for core platform functionality, security,
													and regulatory compliance.
												</p>
												<ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
													<li>User authentication and session management</li>
													<li>KYC verification and compliance monitoring</li>
													<li>
														Transaction processing and portfolio management
													</li>
													<li>Security and fraud prevention</li>
												</ul>
											</div>
											<Checkbox
												checked={preferences.essential}
												disabled
												className="mt-1"
												data-testid="essential-checkbox"
											/>
										</div>
									</CardContent>
								</Card>

								<Card>
									<CardHeader className="pb-3">
										<CardTitle className="flex items-center gap-2 text-lg">
											<Database className="w-5 h-5 text-blue-600" />
											Data Processing & Analytics
										</CardTitle>
									</CardHeader>
									<CardContent>
										<div className="flex items-start justify-between">
											<div className="flex-1">
												<p className="text-sm text-muted-foreground mb-2">
													Advanced portfolio analysis, risk assessment, and
													personalized recommendations.
												</p>
												<ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
													<li>Investment performance analysis</li>
													<li>Risk profiling and asset allocation</li>
													<li>Market trend analysis and insights</li>
													<li>Platform usage analytics</li>
												</ul>
											</div>
											<Checkbox
												checked={preferences.dataProcessing}
												onCheckedChange={(checked) =>
													updatePreference("dataProcessing", !!checked)
												}
												data-testid="data-processing-checkbox"
											/>
										</div>
									</CardContent>
								</Card>

								<Card>
									<CardHeader className="pb-3">
										<CardTitle className="flex items-center gap-2 text-lg">
											<Cookie className="w-5 h-5 text-orange-600" />
											Analytics & Performance
										</CardTitle>
									</CardHeader>
									<CardContent>
										<div className="flex items-start justify-between">
											<div className="flex-1">
												<p className="text-sm text-muted-foreground mb-2">
													Help us understand how you use our platform to improve
													services.
												</p>
												<ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
													<li>Page views and user interactions</li>
													<li>Feature usage statistics</li>
													<li>Performance monitoring</li>
													<li>Error tracking and debugging</li>
												</ul>
											</div>
											<Checkbox
												checked={preferences.analytics}
												onCheckedChange={(checked) =>
													updatePreference("analytics", !!checked)
												}
												data-testid="analytics-checkbox"
											/>
										</div>
									</CardContent>
								</Card>

								<Card>
									<CardHeader className="pb-3">
										<CardTitle className="flex items-center gap-2 text-lg">
											<Mail className="w-5 h-5 text-purple-600" />
											Marketing & Communications
										</CardTitle>
									</CardHeader>
									<CardContent>
										<div className="flex items-start justify-between">
											<div className="flex-1">
												<p className="text-sm text-muted-foreground mb-2">
													Personalized investment opportunities and market
													updates.
												</p>
												<ul className="text-xs text-muted-foreground list-disc list-inside space-y-1">
													<li>Investment opportunity notifications</li>
													<li>Market analysis and research reports</li>
													<li>Product updates and new features</li>
													<li>Educational content and webinars</li>
												</ul>
											</div>
											<Checkbox
												checked={preferences.marketing}
												onCheckedChange={(checked) =>
													updatePreference("marketing", !!checked)
												}
												data-testid="marketing-checkbox"
											/>
										</div>
									</CardContent>
								</Card>
							</div>

							<div className="flex flex-wrap gap-3 pt-4 border-t">
								<Button
									onClick={handleAcceptSelected}
									className="bg-blue-600 hover:bg-blue-700"
									data-testid="save-preferences-button"
								>
									Save Preferences
								</Button>
								<Button
									onClick={() => setShowDetails(false)}
									variant="outline"
									data-testid="back-button"
								>
									Back
								</Button>
							</div>
						</div>
					)}

					<div className="text-xs text-muted-foreground pt-4 border-t">
						<p className="mb-2">
							<strong>Your Rights:</strong> You can change these preferences
							anytime in your account settings. You also have the right to
							access, correct, or delete your data.
						</p>
						<p>
							<strong>Contact:</strong> For privacy questions, email
							privacy@fintekpro.com
						</p>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}

export function useGDPRConsent() {
	const getConsentPreferences = (): ConsentPreferences | null => {
		try {
			const stored = localStorage.getItem("gdpr-consent");
			if (stored) {
				const data = JSON.parse(stored);
				return data.preferences;
			}
		} catch (error) {
			console.error("Error reading consent preferences:", error);
		}
		return null;
	};

	const hasConsent = (type: keyof ConsentPreferences): boolean => {
		const prefs = getConsentPreferences();
		return prefs ? prefs[type] : false;
	};

	const revokeAllConsent = () => {
		localStorage.removeItem("gdpr-consent");
		// Optionally reload page to reset state
		window.location.reload();
	};

	return {
		getConsentPreferences,
		hasConsent,
		revokeAllConsent,
	};
}
