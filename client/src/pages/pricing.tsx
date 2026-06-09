import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useSubscription } from "@/hooks/use-subscription";
import {
	Check,
	Zap,
	Crown,
	Globe,
	TrendingUp,
	Shield as LucideShield,
	BarChart3,
	FileText,
	Users,
	Key,
	ChevronRight,
	Sparkles,
	ArrowLeft,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface Plan {
	tier: string;
	name: string;
	tagline: string;
	monthlyPriceInr: number | null;
	annualPriceInr: number | null;
	features: string[];
	fxSpreadPct: number;
	tradeFeeInr: number | null;
	usTrading: boolean;
	realTimeData: boolean;
	aiReports: boolean;
	portfolioScoring: boolean;
	taxReports: boolean;
	advisorDashboard: boolean;
	dedicatedRM: boolean;
	apiAccess: boolean;
	highlight: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatInr(paise: number): string {
	return new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		maximumFractionDigits: 0,
	}).format(paise);
}

// ── Feature Row ───────────────────────────────────────────────────────────────

function FeatureCheck({
	enabled,
	value,
}: { enabled: boolean; value?: string }) {
	if (value)
		return <span className="text-sm font-medium text-foreground">{value}</span>;
	if (enabled) return <Check className="h-4 w-4 text-green-500 mx-auto" />;
	return (
		<span className="h-4 w-4 block text-center text-muted-foreground/40 mx-auto">
			—
		</span>
	);
}

// ── Plan Card ─────────────────────────────────────────────────────────────────

interface PlanCardProps {
	plan: Plan;
	annual: boolean;
	currentTier?: string;
	onSelect: (tier: string, cycle: string) => void;
	loading?: boolean;
}

function PlanCard({
	plan,
	annual,
	currentTier,
	onSelect,
	loading,
}: PlanCardProps) {
	const isCurrent = currentTier === plan.tier;
	const isUpgrade =
		!isCurrent &&
		plan.tier !== "free" &&
		(["free"].includes(currentTier || "free") ||
			(currentTier === "pro" && plan.tier === "elite"));

	const price = annual ? plan.annualPriceInr : plan.monthlyPriceInr;
	const cycle = annual ? "annual" : "monthly";
	const isElite = plan.tier === "elite";
	const isFree = plan.tier === "free";

	// Elite is annual-only
	const priceDisplay = isElite
		? formatInr(plan.annualPriceInr!)
		: isFree
			? "₹0"
			: price !== null
				? formatInr(price)
				: null;

	const savingsPercent =
		!isFree && !isElite && plan.monthlyPriceInr && plan.annualPriceInr
			? Math.round(
					100 - (plan.annualPriceInr / (plan.monthlyPriceInr * 12)) * 100,
				)
			: 0;

	return (
		<Card
			className={`relative flex flex-col transition-all duration-200 ${
				plan.highlight
					? "border-blue-500 shadow-lg shadow-blue-100 dark:shadow-blue-900/20 scale-105"
					: "border-border hover:border-primary/30"
			} ${isCurrent ? "ring-2 ring-green-500" : ""}`}
		>
			{plan.highlight && (
				<div className="absolute -top-3 left-0 right-0 flex justify-center">
					<Badge className="bg-blue-600 text-white px-4 py-0.5 text-xs font-semibold shadow">
						<Sparkles className="h-3 w-3 mr-1" /> Most Popular
					</Badge>
				</div>
			)}
			{isCurrent && (
				<div className="absolute -top-3 left-0 right-0 flex justify-center">
					<Badge className="bg-green-600 text-white px-4 py-0.5 text-xs font-semibold">
						Current Plan
					</Badge>
				</div>
			)}

			<CardHeader className={`pb-4 ${plan.highlight ? "pt-7" : "pt-5"}`}>
				<div className="flex items-center gap-2 mb-2">
					{plan.tier === "free" && <Globe className="h-5 w-5 text-slate-500" />}
					{plan.tier === "pro" && <Zap className="h-5 w-5 text-blue-500" />}
					{plan.tier === "elite" && (
						<Crown className="h-5 w-5 text-yellow-500" />
					)}
					<span className="font-bold text-lg">{plan.name}</span>
				</div>
				<p className="text-sm text-muted-foreground">{plan.tagline}</p>

				<div className="mt-4">
					{priceDisplay !== null ? (
						<>
							<div className="flex items-baseline gap-1">
								<span className="text-3xl font-extrabold">{priceDisplay}</span>
								<span className="text-sm text-muted-foreground">
									{isElite
										? "/year"
										: isFree
											? ""
											: annual
												? "/year"
												: "/month"}
								</span>
							</div>
							{annual && savingsPercent > 0 && (
								<Badge
									variant="outline"
									className="mt-1 text-xs text-green-600 border-green-300 bg-green-50"
								>
									Save {savingsPercent}% annually
								</Badge>
							)}
							{isElite && (
								<p className="text-xs text-muted-foreground mt-1">
									Annual billing only. HNI & advisor pricing on request.
								</p>
							)}
						</>
					) : (
						<span className="text-sm text-muted-foreground">
							Contact us for pricing
						</span>
					)}
				</div>
			</CardHeader>

			<CardContent className="flex-1 flex flex-col gap-4">
				{/* Revenue metrics */}
				<div className="rounded-lg bg-muted/40 p-3 space-y-1.5 text-xs">
					<div className="flex justify-between">
						<span className="text-muted-foreground">FX Spread</span>
						<span className="font-semibold">{plan.fxSpreadPct}%</span>
					</div>
					<div className="flex justify-between">
						<span className="text-muted-foreground">Per-trade fee</span>
						<span className="font-semibold">
							{plan.tradeFeeInr === 0
								? "₹0 (bundled)"
								: plan.tradeFeeInr === null
									? "N/A"
									: `₹${plan.tradeFeeInr}`}
						</span>
					</div>
				</div>

				{/* Features */}
				<ul className="space-y-2 flex-1">
					{plan.features.map((f) => (
						<li key={f} className="flex items-start gap-2 text-sm">
							<Check className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
							<span>{f}</span>
						</li>
					))}
				</ul>

				{/* CTA */}
				{isFree ? (
					<Button
						variant="outline"
						className="w-full mt-2"
						disabled={isCurrent}
					>
						{isCurrent ? "Your Current Plan" : "Get Started Free"}
					</Button>
				) : (
					<Button
						className={`w-full mt-2 ${
							plan.highlight
								? "bg-blue-600 hover:bg-blue-700"
								: plan.tier === "elite"
									? "bg-gradient-to-r from-yellow-500 to-amber-600 hover:from-yellow-600 hover:to-amber-700 text-white"
									: ""
						}`}
						disabled={isCurrent || loading}
						onClick={() => onSelect(plan.tier, isElite ? "annual" : cycle)}
					>
						{isCurrent ? (
							"Current Plan"
						) : isUpgrade ? (
							<>
								Upgrade to {plan.name} <ChevronRight className="h-4 w-4 ml-1" />
							</>
						) : (
							<>
								Get {plan.name} <ChevronRight className="h-4 w-4 ml-1" />
							</>
						)}
					</Button>
				)}
			</CardContent>
		</Card>
	);
}

// ── Comparison Table ──────────────────────────────────────────────────────────

function ComparisonTable({ plans }: { plans: Plan[] }) {
	const rows = [
		{ label: "US Stock Investing", key: "usTrading", icon: Globe },
		{ label: "Real-time Market Data", key: "realTimeData", icon: TrendingUp },
		{ label: "AI Research Reports", key: "aiReports", icon: BarChart3 },
		{
			label: "Portfolio Health Scoring",
			key: "portfolioScoring",
			icon: LucideShield,
		},
		{ label: "Tax-ready Reports (India)", key: "taxReports", icon: FileText },
		{ label: "Advisor Dashboard", key: "advisorDashboard", icon: Users },
		{ label: "Dedicated RM / WhatsApp", key: "dedicatedRM", icon: Users },
		{ label: "API Access (B2B)", key: "apiAccess", icon: Key },
	] as const;

	return (
		<div className="overflow-x-auto rounded-xl border">
			<table className="w-full text-sm">
				<thead>
					<tr className="border-b bg-muted/30">
						<th className="text-left px-4 py-3 font-semibold w-48">Feature</th>
						{plans.map((p) => (
							<th key={p.tier} className="text-center px-4 py-3 font-semibold">
								{p.name}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.map(({ label, key, icon: Icon }) => (
						<tr
							key={key}
							className="border-b last:border-0 hover:bg-muted/20 transition-colors"
						>
							<td className="px-4 py-3 flex items-center gap-2 text-muted-foreground">
								<Icon className="h-3.5 w-3.5 shrink-0" />
								{label}
							</td>
							{plans.map((p) => (
								<td key={p.tier} className="text-center px-4 py-3">
									<FeatureCheck enabled={p[key as keyof Plan] as boolean} />
								</td>
							))}
						</tr>
					))}
					<tr className="border-b hover:bg-muted/20 transition-colors">
						<td className="px-4 py-3 text-muted-foreground flex items-center gap-2">
							<TrendingUp className="h-3.5 w-3.5 shrink-0" />
							FX Spread (charged)
						</td>
						{plans.map((p) => (
							<td key={p.tier} className="text-center px-4 py-3 font-semibold">
								{p.fxSpreadPct}%
							</td>
						))}
					</tr>
					<tr className="hover:bg-muted/20 transition-colors">
						<td className="px-4 py-3 text-muted-foreground flex items-center gap-2">
							<BarChart3 className="h-3.5 w-3.5 shrink-0" />
							Per-trade Fee
						</td>
						{plans.map((p) => (
							<td key={p.tier} className="text-center px-4 py-3 font-semibold">
								{p.tradeFeeInr === 0
									? "Bundled"
									: p.tradeFeeInr === null
										? "—"
										: `₹${p.tradeFeeInr}`}
							</td>
						))}
					</tr>
				</tbody>
			</table>
		</div>
	);
}

// ── Revenue Model Info ────────────────────────────────────────────────────────

function RevenueInfo() {
	const items = [
		{
			icon: TrendingUp,
			title: "FX Spread Revenue",
			desc: "0.25–1% on every USD remittance. ₹10L investment = up to ₹10,000 FintekPro revenue per transaction.",
		},
		{
			icon: BarChart3,
			title: "Idle Cash Yield",
			desc: "Alpaca yields ~4–5% on uninvested cash. FintekPro retains 1–1.5%, you receive 2.5–3.5%.",
		},
		{
			icon: LucideShield,
			title: "Securities Lending",
			desc: "30–50% of lending income shared passively. Completely hands-off income for investors.",
		},
		{
			icon: Sparkles,
			title: "Referral Rewards",
			desc: "₹500–₹1,000 per funded account you refer. Funded from FX spread margin.",
		},
	];

	return (
		<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
			{items.map(({ icon: Icon, title, desc }) => (
				<div key={title} className="rounded-xl border bg-card p-4 space-y-2">
					<div className="flex items-center gap-2">
						<div className="rounded-lg bg-primary/10 p-2">
							<Icon className="h-4 w-4 text-primary" />
						</div>
						<span className="font-semibold text-sm">{title}</span>
					</div>
					<p className="text-xs text-muted-foreground leading-relaxed">
						{desc}
					</p>
				</div>
			))}
		</div>
	);
}

// ── Payment Modal ─────────────────────────────────────────────────────────────

interface PaymentModalProps {
	tier: string;
	cycle: string;
	onClose: () => void;
}

function PaymentModal({ tier, cycle, onClose }: PaymentModalProps) {
	const { toast } = useToast();

	const checkoutMutation = useMutation({
		mutationFn: async () => {
			const res = await apiRequest("POST", "/api/subscriptions/checkout", {
				tier,
				cycle,
			});
			return res.json();
		},
		onSuccess: (data: any) => {
			if (data.paymentUrl) {
				window.location.href = data.paymentUrl;
			} else if (data.paymentSessionId) {
				toast({ title: "Redirecting to payment…" });
			} else {
				toast({
					title: "Error",
					description: "Could not initiate payment",
					variant: "destructive",
				});
			}
		},
		onError: (err: any) => {
			toast({
				title: "Payment Error",
				description: err.message || "Please try again",
				variant: "destructive",
			});
		},
	});

	const tierName = tier === "pro" ? "Pro" : "Elite";
	const price =
		tier === "pro"
			? cycle === "annual"
				? "₹9,999/year"
				: "₹999/month"
			: "₹25,000/year";

	return (
		<div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
			<div className="bg-background rounded-2xl border shadow-xl max-w-md w-full p-6 space-y-5">
				<div className="flex items-start justify-between">
					<div>
						<h2 className="text-xl font-bold">Upgrade to {tierName}</h2>
						<p className="text-sm text-muted-foreground mt-1">
							{price} billed {cycle}
						</p>
					</div>
					<Button variant="ghost" size="icon" onClick={onClose}>
						✕
					</Button>
				</div>

				<Separator />

				<div className="space-y-3 text-sm">
					<div className="flex items-center gap-3 rounded-lg bg-muted/40 p-3">
						<LucideShield className="h-5 w-5 text-green-500 shrink-0" />
						<div>
							<div className="font-medium">Secure payment via Cashfree</div>
							<div className="text-xs text-muted-foreground">
								UPI, Netbanking, Cards, Wallets accepted
							</div>
						</div>
					</div>
					<div className="flex items-center gap-3 rounded-lg bg-muted/40 p-3">
						<Check className="h-5 w-5 text-blue-500 shrink-0" />
						<div>
							<div className="font-medium">Instant activation</div>
							<div className="text-xs text-muted-foreground">
								Your plan upgrades immediately after payment
							</div>
						</div>
					</div>
					<div className="flex items-center gap-3 rounded-lg bg-muted/40 p-3">
						<FileText className="h-5 w-5 text-purple-500 shrink-0" />
						<div>
							<div className="font-medium">GST Invoice provided</div>
							<div className="text-xs text-muted-foreground">
								18% GST included, invoice sent to your email
							</div>
						</div>
					</div>
				</div>

				<div className="flex gap-3">
					<Button variant="outline" className="flex-1" onClick={onClose}>
						Cancel
					</Button>
					<Button
						className="flex-1 bg-blue-600 hover:bg-blue-700"
						onClick={() => checkoutMutation.mutate()}
						disabled={checkoutMutation.isPending}
					>
						{checkoutMutation.isPending ? "Processing…" : `Pay ${price}`}
					</Button>
				</div>
			</div>
		</div>
	);
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function PricingPage() {
	const [annual, setAnnual] = useState(true);
	const [, setLocation] = useLocation();
	const search = useSearch();
	const { toast } = useToast();
	const [selectedPlan, setSelectedPlan] = useState<{
		tier: string;
		cycle: string;
	} | null>(null);

	const { data: subStatus } = useSubscription();
	const { data: plansData, isLoading: plansLoading } = useQuery<{
		plans: Plan[];
	}>({
		queryKey: ["/api/subscriptions/plans"],
		staleTime: 300_000,
	});

	// Handle Cashfree callback redirect
	useEffect(() => {
		const params = new URLSearchParams(search);
		const status = params.get("status");
		const orderId = params.get("order");

		if (status === "success" && orderId) {
			// Verify the payment
			apiRequest("POST", "/api/subscriptions/verify", { orderId })
				.then((r) => r.json())
				.then((data: any) => {
					if (data.status === "activated") {
						toast({
							title: "🎉 Subscription activated!",
							description: "Your plan is now active. Welcome aboard!",
						});
					}
				})
				.catch(() => {
					toast({
						title: "Payment received",
						description:
							"Your subscription is being activated. Please refresh in a moment.",
					});
				});
		} else if (status === "error") {
			toast({
				title: "Payment failed",
				description: "Please try again or contact support.",
				variant: "destructive",
			});
		}
	}, [search]);

	const plans = plansData?.plans ?? [];
	const currentTier = subStatus?.tier ?? "free";

	function handleSelectPlan(tier: string, cycle: string) {
		if (!subStatus) {
			toast({ title: "Please log in to subscribe", variant: "destructive" });
			return;
		}
		setSelectedPlan({ tier, cycle });
	}

	return (
		<div className="min-h-screen bg-background">
			<div className="max-w-7xl mx-auto px-4 py-12 space-y-16">
				{/* Header */}
				<div className="text-center space-y-4">
					<Button
						variant="ghost"
						size="sm"
						className="mb-4"
						onClick={() => setLocation("/")}
					>
						<ArrowLeft className="h-4 w-4 mr-1" /> Back to Dashboard
					</Button>

					<div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary mb-2">
						<Sparkles className="h-3.5 w-3.5" />
						Bloomberg Terminal for Indian Investors
					</div>
					<h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
						Invest globally, <span className="text-blue-600">pay fairly</span>
					</h1>
					<p className="text-lg text-muted-foreground max-w-2xl mx-auto">
						Access US markets, AI-powered research, and institutional-grade
						analytics. No hidden fees — transparent pricing built for serious
						Indian investors.
					</p>

					{/* Billing Toggle */}
					<div className="flex items-center justify-center gap-3 mt-6">
						<Label
							htmlFor="billing-toggle"
							className={!annual ? "font-semibold" : "text-muted-foreground"}
						>
							Monthly
						</Label>
						<Switch
							id="billing-toggle"
							checked={annual}
							onCheckedChange={setAnnual}
						/>
						<Label
							htmlFor="billing-toggle"
							className={annual ? "font-semibold" : "text-muted-foreground"}
						>
							Annual
							<Badge
								variant="outline"
								className="ml-2 text-xs text-green-600 border-green-300 bg-green-50"
							>
								Save up to 17%
							</Badge>
						</Label>
					</div>
				</div>

				{/* Plan Cards */}
				{plansLoading ? (
					<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
						{[1, 2, 3].map((i) => (
							<div key={i} className="h-96 rounded-xl bg-muted animate-pulse" />
						))}
					</div>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
						{plans.map((plan) => (
							<PlanCard
								key={plan.tier}
								plan={plan}
								annual={annual}
								currentTier={currentTier}
								onSelect={handleSelectPlan}
							/>
						))}
					</div>
				)}

				{/* ARPU Context */}
				<div className="rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border border-blue-100 dark:border-blue-900 p-8">
					<div className="text-center mb-8">
						<h2 className="text-2xl font-bold mb-2">
							How FintekPro makes money
						</h2>
						<p className="text-muted-foreground text-sm">
							Transparent revenue model — you know exactly what you pay and what
							we earn
						</p>
					</div>
					<RevenueInfo />
				</div>

				{/* Comparison Table */}
				{plans.length > 0 && (
					<div>
						<h2 className="text-2xl font-bold text-center mb-6">
							Full Feature Comparison
						</h2>
						<ComparisonTable plans={plans} />
					</div>
				)}

				{/* ARPU projections */}
				<div className="rounded-2xl border bg-card p-8">
					<h2 className="text-2xl font-bold mb-2 text-center">
						Expected returns by tier
					</h2>
					<p className="text-sm text-muted-foreground text-center mb-6">
						What investors typically earn annually across each plan
					</p>
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						{[
							{
								tier: "Free",
								arpu: "₹1,500–₹3,000/yr",
								color: "bg-slate-100 dark:bg-slate-800",
								desc: "Via FX spread, securities lending & cash yield share",
							},
							{
								tier: "Pro",
								arpu: "₹12,000–₹18,000/yr",
								color: "bg-blue-50 dark:bg-blue-950/30",
								desc: "Platform value + lower FX + AI alpha generation",
							},
							{
								tier: "Elite",
								arpu: "₹50,000–₹2,00,000/yr",
								color: "bg-amber-50 dark:bg-amber-950/30",
								desc: "Advisory alpha, alt data, institutional-grade execution",
							},
						].map(({ tier, arpu, color, desc }) => (
							<div
								key={tier}
								className={`rounded-xl ${color} p-5 text-center space-y-2`}
							>
								<div className="text-lg font-bold">{tier}</div>
								<div className="text-2xl font-extrabold text-primary">
									{arpu}
								</div>
								<div className="text-xs text-muted-foreground">{desc}</div>
							</div>
						))}
					</div>
				</div>

				{/* FAQ */}
				<div className="max-w-2xl mx-auto space-y-4">
					<h2 className="text-2xl font-bold text-center mb-6">
						Frequently asked questions
					</h2>
					{[
						{
							q: "How does FX spread work?",
							a: "When you remit funds to your Alpaca account (via LRS), FintekPro charges a small spread on the USD/INR conversion. Free users pay 1%, Pro 0.5%, Elite 0.25–0.4%. On a ₹10L investment, this is ₹10,000 vs ₹5,000 vs ₹2,500.",
						},
						{
							q: "Can I cancel my subscription?",
							a: "Yes, you can cancel anytime. Your plan remains active until the billing period ends. No automatic renewal without consent.",
						},
						{
							q: "Is GST included in the price?",
							a: "All displayed prices are inclusive of 18% GST. A proper GST invoice will be sent to your registered email.",
						},
						{
							q: "What payment methods are supported?",
							a: "UPI (GPay, PhonePe, Paytm), Net Banking, Credit/Debit Cards (Visa, Mastercard, RuPay), and popular wallets — all via Cashfree.",
						},
						{
							q: "Elite plan custom pricing?",
							a: "For family offices, RIAs managing ₹10Cr+ AUM, or firms needing white-labeling, contact us at enterprise@fintekpro.com for bespoke pricing.",
						},
					].map(({ q, a }) => (
						<details
							key={q}
							className="group rounded-xl border bg-card px-5 py-4 cursor-pointer"
						>
							<summary className="font-medium flex items-center justify-between list-none">
								{q}
								<ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90" />
							</summary>
							<p className="mt-3 text-sm text-muted-foreground leading-relaxed">
								{a}
							</p>
						</details>
					))}
				</div>
			</div>

			{/* Payment Modal */}
			{selectedPlan && (
				<PaymentModal
					tier={selectedPlan.tier}
					cycle={selectedPlan.cycle}
					onClose={() => setSelectedPlan(null)}
				/>
			)}
		</div>
	);
}
