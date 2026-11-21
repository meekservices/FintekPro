import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Shield, Lock, Cookie, Settings, Check, X } from "lucide-react";
import { Link } from "wouter";

const CONSENT_STORAGE_KEY = "dpdp_cookie_consent_choice";

interface CookiePreferences {
	essential: boolean; // Always true
	analytics: boolean;
	marketing: boolean;
	savedAt: string;
}

export function DpdpCookieConsentBanner() {
	const [isVisible, setIsVisible] = useState(false);
	const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
	const [analyticsConsent, setAnalyticsConsent] = useState(false);
	const [marketingConsent, setMarketingConsent] = useState(false);

	useEffect(() => {
		try {
			const saved = localStorage.getItem(CONSENT_STORAGE_KEY);
			if (!saved) {
				setIsVisible(true);
			} else {
				const parsed: CookiePreferences = JSON.parse(saved);
				setAnalyticsConsent(parsed.analytics ?? false);
				setMarketingConsent(parsed.marketing ?? false);
			}
		} catch {
			setIsVisible(true);
		}
	}, []);

	const savePreferences = (analytics: boolean, marketing: boolean) => {
		const prefs: CookiePreferences = {
			essential: true,
			analytics,
			marketing,
			savedAt: new Date().toISOString(),
		};
		try {
			localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(prefs));
			fetch("/api/consent", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					preferences: {
						essential: true,
						analytics,
						marketing,
						dpdpConsent: true,
					},
					sourceScreen: "global_footer_banner",
					sourceComponent: "DpdpCookieConsentBanner",
					version: "DPDP_ACT_2023_v1.0",
					timestamp: new Date().toISOString(),
				}),
			}).catch(() => {});
		} catch {}
		setIsVisible(false);
		setIsPreferencesOpen(false);
	};

	const handleAcceptAll = () => {
		savePreferences(true, true);
	};

	const handleRejectNonEssential = () => {
		savePreferences(false, false);
	};

	if (!isVisible) return null;

	return (
		<>
			{/* Bottom Cookie & Privacy Consent Banner */}
			<div className="fixed bottom-0 inset-x-0 z-50 p-4 bg-background/95 backdrop-blur-md border-t border-border shadow-2xl transition-all duration-300">
				<div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
					<div className="space-y-1.5 max-w-3xl">
						<div className="flex items-center gap-2 flex-wrap">
							<Cookie className="h-4 w-4 text-primary" />
							<h4 className="text-sm font-bold text-foreground">
								Privacy & Data Protection Notice (DPDP Act 2023)
							</h4>
							<Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20 font-bold">
								Affirmative Consent Mandate
							</Badge>
						</div>
						<p className="text-xs text-muted-foreground leading-relaxed">
							FintekPro strictly adheres to the <strong>Digital Personal Data Protection Act, 2023</strong>. We use strictly necessary cookies to ensure security, authentication, and statutory audit integrity. We do not track you across third-party sites without affirmative consent. Learn more in our{" "}
							<Link href="/privacy" className="text-primary underline font-medium">
								Privacy Policy
							</Link>{" "}
							and{" "}
							<Link href="/ai-governance" className="text-primary underline font-medium">
								AI Governance Policy
							</Link>.
						</p>
					</div>

					<div className="flex items-center gap-2 flex-wrap shrink-0">
						<Button
							size="sm"
							variant="outline"
							onClick={() => setIsPreferencesOpen(true)}
							className="text-xs font-semibold gap-1.5 h-9"
						>
							<Settings className="h-3.5 w-3.5" />
							Preferences
						</Button>
						<Button
							size="sm"
							variant="secondary"
							onClick={handleRejectNonEssential}
							className="text-xs font-semibold h-9"
						>
							Reject Non-Essential
						</Button>
						<Button
							size="sm"
							onClick={handleAcceptAll}
							className="text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground h-9 shadow-xs"
						>
							Accept All
						</Button>
					</div>
				</div>
			</div>

			{/* Detailed Cookie & Data Preferences Modal */}
			<Dialog open={isPreferencesOpen} onOpenChange={setIsPreferencesOpen}>
				<DialogContent className="max-w-md p-6 space-y-4">
					<DialogHeader>
						<DialogTitle className="text-lg font-bold flex items-center gap-2">
							<Shield className="h-5 w-5 text-primary" />
							Data Protection & Cookie Preferences
						</DialogTitle>
						<DialogDescription className="text-xs text-muted-foreground">
							Customize your data processing preferences under Section 6 of the DPDP Act 2023.
						</DialogDescription>
					</DialogHeader>

					<div className="space-y-4 py-2">
						{/* Essential Cookies (Strictly Necessary) */}
						<div className="p-3 rounded-xl border border-border bg-muted/40 space-y-1.5">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<Lock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
									<Label className="text-xs font-bold text-foreground">
										Strictly Necessary & Statutory
									</Label>
								</div>
								<Badge className="bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-bold">
									Always Active
								</Badge>
							</div>
							<p className="text-[11px] text-muted-foreground leading-relaxed">
								Required for secure account authentication, CSRF defense, SEBI statutory audit logging, and session encryption. Cannot be disabled.
							</p>
						</div>

						{/* Performance & Analytics */}
						<div className="p-3 rounded-xl border border-border bg-card space-y-1.5">
							<div className="flex items-center justify-between">
								<Label htmlFor="analytics-toggle" className="text-xs font-bold text-foreground cursor-pointer">
									Performance & Core Analytics
								</Label>
								<Switch
									id="analytics-toggle"
									checked={analyticsConsent}
									onCheckedChange={setAnalyticsConsent}
								/>
							</div>
							<p className="text-[11px] text-muted-foreground leading-relaxed">
								Helps us monitor server latency, detect API bottlenecks, and optimize market data feed performance. Aggregated and anonymized.
							</p>
						</div>

						{/* Marketing & Advisory Updates */}
						<div className="p-3 rounded-xl border border-border bg-card space-y-1.5">
							<div className="flex items-center justify-between">
								<Label htmlFor="marketing-toggle" className="text-xs font-bold text-foreground cursor-pointer">
									Personalized Advisory Updates
								</Label>
								<Switch
									id="marketing-toggle"
									checked={marketingConsent}
									onCheckedChange={setMarketingConsent}
								/>
							</div>
							<p className="text-[11px] text-muted-foreground leading-relaxed">
								Permits notifications regarding market regime shifts, tax-harvesting opportunities, and new investment product offerings.
							</p>
						</div>
					</div>

					<DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-border">
						<Button
							variant="outline"
							size="sm"
							onClick={() => savePreferences(false, false)}
							className="w-full sm:w-auto text-xs"
						>
							Reject All Optional
						</Button>
						<Button
							size="sm"
							onClick={() => savePreferences(analyticsConsent, marketingConsent)}
							className="w-full sm:w-auto text-xs font-bold bg-primary"
						>
							Save My Preferences
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
