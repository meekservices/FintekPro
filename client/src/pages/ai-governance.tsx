import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import {
	Shield,
	Bot,
	Cpu,
	Scale,
	Lock,
	AlertTriangle,
	CheckCircle2,
	Eye,
	Activity,
	FileText,
	UserCheck,
	ArrowRight,
	HelpCircle,
	Building2,
	RefreshCw,
	Power,
} from "lucide-react";

export default function AiGovernancePage() {
	useEffect(() => {
		document.title = "AI Ethics & Algorithmic Governance Policy - FintekPro";
		window.scrollTo(0, 0);
	}, []);

	return (
		<div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-background to-indigo-50/20 dark:from-background dark:via-background dark:to-card">
			<main className="py-12 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-8">
				{/* Header Section */}
				<div className="text-center space-y-4">
					<div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-100/80 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-semibold">
						<Bot className="h-4 w-4" />
						Multi-Regulator AI Compliance Framework (MR-AICF v1.0)
					</div>
					<h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-foreground">
						AI Ethics & Algorithmic Governance Policy
					</h1>
					<p className="text-base sm:text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
						Institutional standards for artificial intelligence, machine learning, and quantitative modeling on{" "}
						<strong className="text-foreground">fintekpro.com</strong>. Governed by SEBI, RBI, DPDP Act 2023, and MeitY directives.
					</p>
					<div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-1">
						<span>Standard: <strong>MR-AICF-1.0.0</strong></span>
						<span>•</span>
						<span>Effective: <strong>November 2026</strong></span>
						<span>•</span>
						<span>Status: <strong className="text-emerald-600 dark:text-emerald-400">Production Live (SSOT)</strong></span>
					</div>
				</div>

				{/* Primary Mandatory Disclosure Banner */}
				<div className="p-6 rounded-2xl border-2 border-blue-300 dark:border-blue-800 bg-gradient-to-r from-blue-50/90 via-indigo-50/50 to-blue-50/90 dark:from-blue-950/40 dark:via-indigo-950/20 dark:to-blue-950/40 shadow-sm space-y-3">
					<div className="flex items-start gap-4">
						<div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-xs shrink-0 mt-0.5">
							<Shield className="h-6 w-6" />
						</div>
						<div className="space-y-1.5">
							<div className="flex items-center gap-2 flex-wrap">
								<h2 className="text-lg font-bold text-blue-950 dark:text-blue-200">
									Decision Support System (DSS) Mandate — Zero Autonomous Execution
								</h2>
								<Badge className="bg-blue-600 text-white text-[10px] uppercase font-bold">
									SEBI Fiduciary Rule
								</Badge>
							</div>
							<p className="text-sm text-blue-900/90 dark:text-blue-300/90 leading-relaxed">
								FintekPro’s AI engines act exclusively as an assistive <strong>Decision Support System (DSS)</strong> for investors, Chartered Accountants (CAs), and SEBI-registered Investment Advisers (RIAs). 
								<strong> The AI possesses ZERO execution keys and never autonomously places orders, executes trades, moves funds, or files tax returns.</strong> Every financial action requires affirmative, authenticated human authorization (OTP, client biometric, or digital signature).
							</p>
						</div>
					</div>
				</div>

				{/* 7 Core AI Governance Pillars */}
				<div className="space-y-6">
					<div className="border-b border-border pb-2">
						<h3 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
							<Cpu className="h-5 w-5 text-primary" />
							The Seven Pillars of FintekPro AI Governance
						</h3>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
						{/* Pillar 1: Canonical Math & Zero Synthetic Data */}
						<Card className="border-border shadow-xs hover:border-primary/40 transition-colors">
							<CardHeader className="pb-3">
								<div className="flex items-center justify-between">
									<Badge variant="outline" className="text-xs font-semibold text-primary border-primary/30">
										Pillar 1 • Data Integrity
									</Badge>
									<CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
								</div>
								<CardTitle className="text-base font-bold pt-2 flex items-center gap-2">
									<Scale className="h-4 w-4 text-primary" />
									Zero-Synthetic Data & Canonical Formulas
								</CardTitle>
							</CardHeader>
							<CardContent className="text-sm text-muted-foreground space-y-2.5">
								<p>
									In strict compliance with <strong>DCP v2.0</strong> and <strong>SOP-SDCG-01</strong>, FintekPro completely bans synthetic, mock, or randomized (<code>Math.random()</code>) pricing in production.
								</p>
								<ul className="list-disc list-inside space-y-1 text-xs">
									<li>Direct live feeds from licensed gateways (NSE, BSE, MCX via Upstox; FBIL; CCIL).</li>
									<li>No magic multipliers (e.g. <code>* 1.0016</code>) or ETF proxy scalers.</li>
									<li>All valuations derive from peer-reviewed quantitative finance (Black-Scholes, DCF with derived WACC, standard XIRR/TWRR).</li>
								</ul>
							</CardContent>
						</Card>

						{/* Pillar 2: DPDP Privacy Firewall */}
						<Card className="border-border shadow-xs hover:border-primary/40 transition-colors">
							<CardHeader className="pb-3">
								<div className="flex items-center justify-between">
									<Badge variant="outline" className="text-xs font-semibold text-primary border-primary/30">
										Pillar 2 • Privacy & DPDP
									</Badge>
									<Lock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
								</div>
								<CardTitle className="text-base font-bold pt-2 flex items-center gap-2">
									<Lock className="h-4 w-4 text-primary" />
									The Privacy Firewall (Zero PII to LLMs)
								</CardTitle>
							</CardHeader>
							<CardContent className="text-sm text-muted-foreground space-y-2.5">
								<p>
									Under Section 6-9 of the <strong>Digital Personal Data Protection Act, 2023</strong>, client financial data is protected by an automated pre-prompt redaction middleware:
								</p>
								<ul className="list-disc list-inside space-y-1 text-xs">
									<li><strong>Aadhaar & PAN:</strong> Masked and tokenized before any external LLM invocation.</li>
									<li><strong>Bank & Demat Accounts:</strong> Obfuscated to last 4 digits (<code>[ACCT_XXXX]</code>).</li>
									<li><strong>Zero Data Retention (ZDR):</strong> Contractual enterprise guarantees barring AI providers from training on client payloads.</li>
								</ul>
							</CardContent>
						</Card>

						{/* Pillar 3: Explainability & Audit Lineage */}
						<Card className="border-border shadow-xs hover:border-primary/40 transition-colors">
							<CardHeader className="pb-3">
								<div className="flex items-center justify-between">
									<Badge variant="outline" className="text-xs font-semibold text-primary border-primary/30">
										Pillar 3 • Transparency
									</Badge>
									<Eye className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
								</div>
								<CardTitle className="text-base font-bold pt-2 flex items-center gap-2">
									<Eye className="h-4 w-4 text-primary" />
									Deterministic Explainability Layer
								</CardTitle>
							</CardHeader>
							<CardContent className="text-sm text-muted-foreground space-y-2.5">
								<p>
									FintekPro rejects "black-box" decision-making. Every algorithmic insight, asset allocation, or tax harvest plan exposes its complete lineage:
								</p>
								<ul className="list-disc list-inside space-y-1 text-xs">
									<li>Exposes inputs used, mathematical formulas applied, and intermediate steps.</li>
									<li>Displays <code>model_version</code>, <code>engine_version</code>, and ISO timestamp.</li>
									<li>Provides step-by-step audit rationale for CA / RIA supervisory review.</li>
								</ul>
							</CardContent>
						</Card>

						{/* Pillar 4: Model Risk Management & Drift Detection */}
						<Card className="border-border shadow-xs hover:border-primary/40 transition-colors">
							<CardHeader className="pb-3">
								<div className="flex items-center justify-between">
									<Badge variant="outline" className="text-xs font-semibold text-primary border-primary/30">
										Pillar 4 • Model Governance
									</Badge>
									<Activity className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
								</div>
								<CardTitle className="text-base font-bold pt-2 flex items-center gap-2">
									<Activity className="h-4 w-4 text-primary" />
									Model Drift & OOD Volatility Tripwires
								</CardTitle>
							</CardHeader>
							<CardContent className="text-sm text-muted-foreground space-y-2.5">
								<p>
									Aligned with <strong>RBI Model Risk Management (MRM)</strong> standards, all quantitative models undergo continuous automated supervision:
								</p>
								<ul className="list-disc list-inside space-y-1 text-xs">
									<li>Daily statistical tracking of data drift and concept drift over rolling 30-day windows.</li>
									<li><strong>Out-of-Distribution (OOD) Tripwire:</strong> When market volatility exceeds 3.5σ, models automatically downgrade confidence and flag human advisors.</li>
									<li>Quarterly stress-testing against historical crash scenarios (2008, 2020).</li>
								</ul>
							</CardContent>
						</Card>

						{/* Pillar 5: Automated Decision Contestability */}
						<Card className="border-border shadow-xs hover:border-primary/40 transition-colors">
							<CardHeader className="pb-3">
								<div className="flex items-center justify-between">
									<Badge variant="outline" className="text-xs font-semibold text-primary border-primary/30">
										Pillar 5 • Client Rights
									</Badge>
									<UserCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
								</div>
								<CardTitle className="text-base font-bold pt-2 flex items-center gap-2">
									<UserCheck className="h-4 w-4 text-primary" />
									Right to Human Review (Contestability)
								</CardTitle>
							</CardHeader>
							<CardContent className="text-sm text-muted-foreground space-y-2.5">
								<p>
									In accordance with Section 12 of the DPDP Act 2023, automated classifications never bind an investor irrevocably:
								</p>
								<ul className="list-disc list-inside space-y-1 text-xs">
									<li>Every user has the statutory right to contest an AI recommendation or risk scoring.</li>
									<li>1-click request to route the dossier for manual review by an empaneled human RIA or CA.</li>
									<li>Human advisors can override or calibrate model outputs with mandatory audit logs.</li>
								</ul>
							</CardContent>
						</Card>

						{/* Pillar 6: Anti-Hallucination Sentinel */}
						<Card className="border-border shadow-xs hover:border-primary/40 transition-colors">
							<CardHeader className="pb-3">
								<div className="flex items-center justify-between">
									<Badge variant="outline" className="text-xs font-semibold text-primary border-primary/30">
										Pillar 6 • Quality Assurance
									</Badge>
									<RefreshCw className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
								</div>
								<CardTitle className="text-base font-bold pt-2 flex items-center gap-2">
									<RefreshCw className="h-4 w-4 text-primary" />
									Autonomous Sentinel & Self-Healing
								</CardTitle>
							</CardHeader>
							<CardContent className="text-sm text-muted-foreground space-y-2.5">
								<p>
									The <code>KnowledgeHubAutoHealSentinel</code> operates 24/7 across all market data corridors:
								</p>
								<ul className="list-disc list-inside space-y-1 text-xs">
									<li>Audits active snapshots against official exchange clearing corridors (FBIL FX, MCX Spot).</li>
									<li>Triggers automated cache invalidation and re-crawl on detected corridor deviations.</li>
									<li>Flags data quality warnings on user dashboards if upstream exchanges experience delays.</li>
								</ul>
							</CardContent>
						</Card>
					</div>

					{/* Pillar 7: Emergency Algorithmic Kill-Switch (Full Width) */}
					<Card className="border-amber-300 dark:border-amber-800/80 bg-gradient-to-r from-amber-50/40 via-background to-amber-50/40 dark:from-amber-950/20 dark:via-background dark:to-amber-950/20 shadow-xs">
						<CardHeader className="pb-3">
							<div className="flex items-center justify-between">
								<Badge className="bg-amber-100 text-amber-900 dark:bg-amber-950/80 dark:text-amber-300 border-amber-300 font-bold text-xs">
									Pillar 7 • Emergency Safeguard
								</Badge>
								<Power className="h-4 w-4 text-amber-600 dark:text-amber-400" />
							</div>
							<CardTitle className="text-base font-bold pt-2 flex items-center gap-2 text-foreground">
								<AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
								Hardware-Backed Global Algorithmic Kill-Switch
							</CardTitle>
						</CardHeader>
						<CardContent className="text-sm text-muted-foreground space-y-2">
							<p>
								Under SEBI Cybersecurity & Cyber Resilience Framework (CSCRF) mandates, FintekPro maintains an administrative hardware-backed <strong>Global AI Kill-Switch</strong>. In the event of an upstream market feed anomaly, regulatory directive, or suspected model hallucination, compliance officers can instantly deactivate client-facing AI recommendations across <code>fintekpro.com</code> within <strong>&lt; 100 milliseconds</strong>, seamlessly reverting the portal to human-supervised deterministic operations.
							</p>
						</CardContent>
					</Card>
				</div>

				{/* Regulatory Alignment Matrix */}
				<Card className="border-border shadow-xs">
					<CardHeader>
						<CardTitle className="text-lg font-bold flex items-center gap-2">
							<Building2 className="h-5 w-5 text-primary" />
							Regulatory Statutory Alignment
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4 text-sm text-muted-foreground">
						<div className="overflow-x-auto">
							<table className="w-full text-left border-collapse text-xs sm:text-sm">
								<thead>
									<tr className="border-b border-border bg-muted/40">
										<th className="p-3 font-semibold text-foreground">Regulator / Act</th>
										<th className="p-3 font-semibold text-foreground">Statutory Scope</th>
										<th className="p-3 font-semibold text-foreground">FintekPro Enforcement</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-border">
									<tr>
										<td className="p-3 font-bold text-foreground">SEBI</td>
										<td className="p-3">IA Regs (15, 17, 19, 22), AI/ML Circular, Advertising Code</td>
										<td className="p-3">HITL mandate; 365-day risk profile lock; TRI benchmarks; Direct Plan routing for RIAs.</td>
									</tr>
									<tr>
										<td className="p-3 font-bold text-foreground">RBI</td>
										<td className="p-3">Model Risk Management (MRM), Digital Lending (DLG), FEMA</td>
										<td className="p-3">Zero phone contact/SMS scraping; KFS presentation; strict bar on offshore CFDs under LRS.</td>
									</tr>
									<tr>
										<td className="p-3 font-bold text-foreground">DPDP Act 2023</td>
										<td className="p-3">Sections 6, 8, 9, 12, 13 (Privacy, Consent, Contestability)</td>
										<td className="p-3">PII pre-prompt redaction; Zero Data Retention; automated decision contestability right.</td>
									</tr>
									<tr>
										<td className="p-3 font-bold text-foreground">MeitY</td>
										<td className="p-3">AI Directives & Content Labeling (2024)</td>
										<td className="p-3">Standardized AI disclosure watermark on all advisory views and downloadable PDFs.</td>
									</tr>
									<tr>
										<td className="p-3 font-bold text-foreground">Income Tax Dept</td>
										<td className="p-3">Income Tax Act 1961, Sec 55(2)(ac), Sec 206C(1G)</td>
										<td className="p-3">Zero synthetic tax math; FMV grandfathering for pre-2018 equities; CA sign-off gate.</td>
									</tr>
									<tr>
										<td className="p-3 font-bold text-foreground">CERT-In</td>
										<td className="p-3">Cyber Security Directions (2022) & CSCRF</td>
										<td className="p-3">Millisecond NPL/NIC NTP time sync (±50ms); 6-hour security incident notification; 5-year log WORM store.</td>
									</tr>
								</tbody>
							</table>
						</div>
					</CardContent>
				</Card>

				{/* Contact, Grievance & Legal Navigation */}
				<div className="p-6 rounded-2xl border border-border bg-card/60 shadow-xs space-y-4">
					<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
						<div>
							<h4 className="text-base font-bold text-foreground">
								AI Ethics & Regulatory Grievance Desk
							</h4>
							<p className="text-xs sm:text-sm text-muted-foreground mt-1">
								For inquiries regarding algorithmic transparency, model explainability, or to exercise your DPDP contestability rights:
							</p>
						</div>
						<div className="flex flex-col sm:text-right text-xs space-y-1 shrink-0">
							<span className="font-semibold text-foreground">Grievance Officer: CS & Principal Officer</span>
							<span className="text-primary font-mono">grievance@fintekpro.com</span>
							<span className="text-muted-foreground">Response Window: Within 48 Hours</span>
						</div>
					</div>

					<div className="pt-4 border-t border-border flex flex-wrap items-center justify-between gap-3 text-xs">
						<div className="flex items-center gap-4">
							<Link href="/disclaimer" className="text-primary hover:underline flex items-center gap-1 font-medium">
								Investment Risk Disclaimer <ArrowRight className="h-3 w-3" />
							</Link>
							<Link href="/privacy" className="text-primary hover:underline flex items-center gap-1 font-medium">
								Privacy Policy (DPDP) <ArrowRight className="h-3 w-3" />
							</Link>
							<Link href="/terms" className="text-primary hover:underline flex items-center gap-1 font-medium">
								Terms of Service <ArrowRight className="h-3 w-3" />
							</Link>
						</div>
						<span className="text-muted-foreground">
							© {new Date().getFullYear()} FINTEKPRO FINANCIAL SERVICES LLP. Regulated Entity.
						</span>
					</div>
				</div>
			</main>
		</div>
	);
}
