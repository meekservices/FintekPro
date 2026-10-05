import { useState, useMemo } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
	ArrowLeft,
	BookOpen,
	AlertCircle,
	CheckCircle2,
	Tag,
	Sparkles,
	Copy,
	Check,
	Smartphone,
	Mail,
	Printer,
	Share2,
	ShieldCheck,
	Clock,
	TrendingUp,
	FileText,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { apiRequest } from "@/lib/queryClient";

interface ProductKnowledge {
	id: string;
	productType: string;
	title: string;
	productCategory?: string;
	productSubCategory?: string;
	description: string;
	keyFeatures: { feature: string; explanation?: string }[];
	riskProfile: string;
	timeHorizon?: string;
	suitabilityRules?: { rule: string; applicableTo: string }[];
	contraindications?: { scenario: string; reason: string }[];
	version: number;
	status: string;
	publishedAt?: string;
	tags?: string[];
}

const getRiskBadgeColor = (risk: string) => {
	switch (risk?.toLowerCase()) {
		case "conservative":
			return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
		case "moderate":
			return "bg-amber-500/20 text-amber-400 border-amber-500/30";
		case "aggressive":
			return "bg-orange-500/20 text-orange-400 border-orange-500/30";
		case "very_aggressive":
			return "bg-red-500/20 text-red-400 border-red-500/30";
		default:
			return "bg-muted/20 text-muted-foreground border-border/30";
	}
};

export default function AgentProductDetailPage() {
	const [, setLocation] = useLocation();
	const [, routeParams] = useRoute("/agent/knowledge-hub/products/:id");
	const { toast } = useToast();

	// Support query param ?id=... or route param /:id
	const searchParams = useMemo(() => {
		if (typeof window === "undefined") return new URLSearchParams();
		return new URLSearchParams(window.location.search);
	}, []);

	const productId = routeParams?.id || searchParams.get("id") || "";

	// FASP-AI Client Pitch Generator State
	const [pitchPersona, setPitchPersona] = useState<
		"young_wealth_builder" | "conservative_senior" | "hni_tax_optimizer" | "business_owner"
	>("young_wealth_builder");
	const [pitchChannel, setPitchChannel] = useState<"whatsapp" | "email">("whatsapp");
	const [generatedPitch, setGeneratedPitch] = useState<string | null>(null);
	const [isGeneratingPitch, setIsGeneratingPitch] = useState(false);
	const [hasCopiedPitch, setHasCopiedPitch] = useState(false);

	const { data: product, isLoading, error } = useQuery<ProductKnowledge>({
		queryKey: [`/api/knowledge-hub/products/${productId}`],
		queryFn: async () => {
			if (!productId) throw new Error("Product ID is required");
			const res = await apiRequest("GET", `/api/knowledge-hub/products/${encodeURIComponent(productId)}`);
			return typeof res?.json === "function" ? await res.json() : res;
		},
		enabled: !!productId,
		staleTime: 1000 * 60 * 30, // 30 minutes
	});

	const handleGeneratePitch = async () => {
		if (!product) return;
		try {
			setIsGeneratingPitch(true);
			setGeneratedPitch(null);
			setHasCopiedPitch(false);

			const keyFeatures = (product.keyFeatures || []).map((f) =>
				typeof f === "string" ? f : f.feature,
			);

			const res = await apiRequest("POST", "/api/knowledge-hub/generate-pitch", {
				productTitle: product.title,
				productType: product.productType,
				persona: pitchPersona,
				channel: pitchChannel,
				keyFeatures,
				riskProfile: product.riskProfile,
			});

			const data = typeof res?.json === "function" ? await res.json() : res;
			if (data?.success && data.pitch) {
				setGeneratedPitch(data.pitch);
				toast({
					title: "FASP-AI Pitch Drafted ✓",
					description: `Tailored for ${pitchPersona.replace(/_/g, " ")} (${pitchChannel.toUpperCase()}).`,
				});
			} else {
				throw new Error(data?.error || "Failed to generate pitch");
			}
		} catch (err: any) {
			toast({
				title: "Pitch Generation Failed",
				description: err.message,
				variant: "destructive",
			});
		} finally {
			setIsGeneratingPitch(false);
		}
	};

	const handleCopyPitch = () => {
		if (!generatedPitch) return;
		navigator.clipboard.writeText(generatedPitch);
		setHasCopiedPitch(true);
		toast({
			title: "Copied to Clipboard! 📋",
			description: "Ready to paste into WhatsApp or Client Email.",
		});
		setTimeout(() => setHasCopiedPitch(false), 2500);
	};

	const handlePrint = () => {
		window.print();
	};

	const handleShare = () => {
		if (navigator.clipboard) {
			navigator.clipboard.writeText(window.location.href);
			toast({
				title: "Product Dossier Link Copied 📋",
				description: "Direct URL copied to clipboard.",
			});
		}
	};

	if (isLoading) {
		return (
			<div className="max-w-6xl mx-auto p-6 space-y-6">
				<div className="flex items-center gap-3">
					<Skeleton className="h-9 w-24" />
					<Skeleton className="h-9 w-64" />
				</div>
				<Skeleton className="h-44 w-full" />
				<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
					<Skeleton className="h-96 md:col-span-2" />
					<Skeleton className="h-96" />
				</div>
			</div>
		);
	}

	if (error || !product) {
		return (
			<div className="max-w-4xl mx-auto p-12 text-center space-y-4">
				<BookOpen className="h-16 w-16 text-muted-foreground mx-auto" />
				<h2 className="text-2xl font-bold text-foreground">Product Dossier Not Found</h2>
				<p className="text-muted-foreground text-sm">
					The requested product could not be located or may not be published.
				</p>
				<Button
					onClick={() => setLocation("/agent/knowledge-hub/products")}
					className="bg-amber-600 hover:bg-amber-700 text-white"
				>
					<ArrowLeft className="h-4 w-4 mr-1.5" />
					Return to Products Catalog
				</Button>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-background text-foreground flex flex-col">
			{/* Top Sticky Header */}
			<header className="sticky top-0 z-40 border-b border-border/70 bg-background/95 backdrop-blur-md px-4 sm:px-6 py-3 shadow-sm">
				<div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
					<div className="flex items-center gap-3">
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setLocation("/agent/knowledge-hub/products")}
							className="h-8 px-2 text-muted-foreground hover:text-foreground -ml-2"
						>
							<ArrowLeft className="h-4 w-4 mr-1.5" />
							<span className="hidden sm:inline">All Products</span>
						</Button>

						<div className="h-4 w-px bg-border/60" />

						<div className="flex items-center gap-2">
							<Badge variant="outline" className="text-xs border-amber-500/40 text-amber-400 font-mono">
								{product.productType.replace(/_/g, " ").toUpperCase()}
							</Badge>
							<span className="text-xs text-muted-foreground hidden md:inline">
								Product Knowledge Dossier v{product.version}
							</span>
						</div>
					</div>

					<div className="flex items-center gap-2">
						<Button
							size="sm"
							variant="outline"
							onClick={handleShare}
							title="Copy Direct Link"
							className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground"
						>
							<Share2 className="h-3.5 w-3.5 mr-1" />
							<span className="hidden sm:inline">Share</span>
						</Button>
						<Button
							size="sm"
							variant="outline"
							onClick={handlePrint}
							title="Print Fact Sheet"
							className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground hidden sm:flex"
						>
							<Printer className="h-3.5 w-3.5 mr-1" />
							<span>Print PDF</span>
						</Button>
					</div>
				</div>
			</header>

			{/* Main Dossier Content */}
			<main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
				{/* Hero Card */}
				<Card className="bg-card/70 border-border/80 shadow-md backdrop-blur-sm">
					<CardHeader className="pb-4">
						<div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
							<div className="space-y-1.5">
								<div className="flex items-center gap-2 flex-wrap">
									{product.productCategory && (
										<span className="text-xs font-semibold uppercase tracking-wider text-amber-500">
											{product.productCategory}
										</span>
									)}
									{product.productSubCategory && (
										<span className="text-xs text-muted-foreground">
											• {product.productSubCategory}
										</span>
									)}
								</div>
								<CardTitle className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
									{product.title}
								</CardTitle>
								<CardDescription className="text-sm sm:text-base text-muted-foreground max-w-3xl leading-relaxed">
									{product.description}
								</CardDescription>
							</div>

							{/* Badges Column */}
							<div className="flex flex-row md:flex-col items-start md:items-end gap-2 shrink-0">
								<Badge className={`text-xs px-2.5 py-1 ${getRiskBadgeColor(product.riskProfile)}`}>
									{product.riskProfile.replace(/_/g, " ").toUpperCase()} RISK
								</Badge>
								{product.timeHorizon && (
									<Badge variant="outline" className="text-xs border-border/70 text-muted-foreground">
										<Clock className="h-3 w-3 mr-1 text-amber-400" />
										{product.timeHorizon}
									</Badge>
								)}
							</div>
						</div>

						{/* Tags */}
						{product.tags && product.tags.length > 0 && (
							<div className="flex flex-wrap gap-1.5 pt-3 border-t border-border/50">
								{product.tags.map((tag, idx) => (
									<Badge
										key={idx}
										variant="outline"
										className="text-[11px] border-border text-muted-foreground"
									>
										<Tag className="h-2.5 w-2.5 mr-1 text-amber-400" />
										{tag}
									</Badge>
								))}
							</div>
						)}
					</CardHeader>
				</Card>

				{/* 4 Tabs: Overview, Suitability, Compliance, Pitch Builder */}
				<Tabs defaultValue="overview" className="w-full">
					<TabsList className="bg-card border border-border/70 p-1 mb-6 flex-wrap h-auto gap-1">
						<TabsTrigger value="overview" className="text-xs sm:text-sm px-4 py-2">
							<FileText className="h-4 w-4 mr-1.5" />
							Overview & Features
						</TabsTrigger>
						<TabsTrigger value="suitability" className="text-xs sm:text-sm px-4 py-2">
							<TrendingUp className="h-4 w-4 mr-1.5" />
							Suitability & Client Fit
						</TabsTrigger>
						<TabsTrigger value="compliance" className="text-xs sm:text-sm px-4 py-2">
							<ShieldCheck className="h-4 w-4 mr-1.5" />
							Compliance & SEBI Mandates
						</TabsTrigger>
						<TabsTrigger
							value="pitch"
							className="text-xs sm:text-sm px-4 py-2 text-emerald-400 font-semibold data-[state=active]:bg-emerald-600 data-[state=active]:text-white"
						>
							<Sparkles className="h-4 w-4 mr-1.5" />
							FASP-AI Client Pitch Builder
						</TabsTrigger>
					</TabsList>

					{/* Tab 1: Overview */}
					<TabsContent value="overview" className="space-y-6">
						{/* Key Features */}
						<div className="space-y-3">
							<h3 className="text-base font-bold text-foreground flex items-center gap-2">
								<CheckCircle2 className="h-5 w-5 text-emerald-400" />
								Core Product Features & Investor Benefits
							</h3>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
								{product.keyFeatures?.map((feature, idx) => (
									<div
										key={idx}
										className="p-4 rounded-xl bg-card/60 border border-border/70 text-sm space-y-1 shadow-sm"
									>
										<div className="font-semibold text-foreground flex items-center gap-2">
											<span className="h-2 w-2 rounded-full bg-emerald-400" />
											{typeof feature === "string" ? feature : feature.feature}
										</div>
										{typeof feature !== "string" && feature.explanation && (
											<p className="text-xs text-muted-foreground pl-4 leading-relaxed">
												{feature.explanation}
											</p>
										)}
									</div>
								))}
							</div>
						</div>

						{/* Contraindications / When Not to Recommend */}
						{product.contraindications && product.contraindications.length > 0 && (
							<div className="space-y-3 pt-4 border-t border-border/50">
								<h3 className="text-base font-bold text-amber-400 flex items-center gap-2">
									<AlertCircle className="h-5 w-5 text-amber-400" />
									Contraindications • When NOT to Recommend
								</h3>
								<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
									{product.contraindications.map((item, idx) => (
										<div
											key={idx}
											className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 text-sm space-y-1"
										>
											<div className="font-semibold text-amber-300 flex items-center gap-2">
												<AlertCircle className="h-4 w-4 text-amber-400 shrink-0" />
												{typeof item === "string" ? item : item.scenario}
											</div>
											{typeof item !== "string" && item.reason && (
												<p className="text-xs text-muted-foreground pl-6 leading-relaxed">
													{item.reason}
												</p>
											)}
										</div>
									))}
								</div>
							</div>
						)}
					</TabsContent>

					{/* Tab 2: Suitability */}
					<TabsContent value="suitability" className="space-y-6">
						<div className="space-y-3">
							<h3 className="text-base font-bold text-foreground flex items-center gap-2">
								<TrendingUp className="h-5 w-5 text-blue-400" />
								Suitability Framework & Client Persona Match
							</h3>
							{product.suitabilityRules && product.suitabilityRules.length > 0 ? (
								<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
									{product.suitabilityRules.map((rule, idx) => (
										<div
											key={idx}
											className="p-4 rounded-xl bg-card/60 border border-border/70 space-y-2 shadow-sm"
										>
											<div className="text-xs font-semibold uppercase tracking-wider text-blue-400">
												Applicable To: {rule.applicableTo}
											</div>
											<p className="text-sm text-foreground leading-relaxed">
												{rule.rule}
											</p>
										</div>
									))}
								</div>
							) : (
								<div className="p-6 rounded-xl bg-card border border-border text-center text-sm text-muted-foreground">
									Applicable to investors with a {product.riskProfile} risk profile and a minimum investment horizon of {product.timeHorizon || "3+ years"}.
								</div>
							)}
						</div>
					</TabsContent>

					{/* Tab 3: Compliance */}
					<TabsContent value="compliance" className="space-y-6">
						<div className="p-5 rounded-xl bg-card border border-border/80 space-y-3">
							<h3 className="text-base font-bold text-foreground flex items-center gap-2">
								<ShieldCheck className="h-5 w-5 text-emerald-400" />
								Regulatory & Compliance Safeguards (SEBI / FASP-AI v1.0)
							</h3>
							<p className="text-sm text-muted-foreground leading-relaxed">
								Under SEBI (Investment Advisers) Regulations, 2013 and SEBI Research Analyst guidelines, investment suitability must be assessed and documented before recommending {product.title}. Ensure client risk profiling is current within the preceding 12 months.
							</p>
							<div className="pt-3 border-t border-border/50 flex flex-wrap gap-4 text-xs text-muted-foreground">
								<div>
									<span className="font-semibold text-foreground">Status:</span> {product.status.toUpperCase()}
								</div>
								<div>
									<span className="font-semibold text-foreground">Dossier Version:</span> v{product.version}
								</div>
								{product.publishedAt && (
									<div>
										<span className="font-semibold text-foreground">Published:</span> {new Date(product.publishedAt).toLocaleDateString()}
									</div>
								)}
							</div>
						</div>
					</TabsContent>

					{/* Tab 4: AI Pitch Builder */}
					<TabsContent value="pitch" className="space-y-6">
						<Card className="bg-card border-emerald-500/30 shadow-lg">
							<CardHeader className="pb-4">
								<CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
									<Sparkles className="h-5 w-5 text-emerald-400" />
									FASP-AI Client Pitch Generator
								</CardTitle>
								<CardDescription className="text-xs text-muted-foreground">
									Generate compliant, high-conversion WhatsApp notes and client emails tailored for specific investor personas.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-6">
								{/* Persona Selection */}
								<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5">
									{[
										{ id: "young_wealth_builder", label: "Young Wealth Builder", sub: "Age 25–40 • Compounding" },
										{ id: "conservative_senior", label: "Conservative Senior", sub: "Age 60+ • Capital Protection" },
										{ id: "hni_tax_optimizer", label: "HNI Tax Optimizer", sub: "Surplus Capital • Tax Drag" },
										{ id: "business_owner", label: "Business Owner / Treasury", sub: "Corporate Reserve • Liquidity" },
									].map((p) => (
										<button
											key={p.id}
											type="button"
											onClick={() => setPitchPersona(p.id as any)}
											className={`p-3 rounded-lg border text-left transition-all ${
												pitchPersona === p.id
													? "bg-emerald-500/15 border-emerald-500/60 ring-1 ring-emerald-500/40 text-foreground"
													: "bg-background/60 border-border/70 hover:bg-muted/40 text-muted-foreground"
											}`}
										>
											<div className="text-xs font-bold text-foreground">{p.label}</div>
											<div className="text-[10px] text-muted-foreground mt-0.5">{p.sub}</div>
										</button>
									))}
								</div>

								{/* Channel Selection & Generate Button */}
								<div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2 border-t border-border/50">
									<div className="flex items-center gap-2">
										<Button
											type="button"
											size="sm"
											variant={pitchChannel === "whatsapp" ? "default" : "outline"}
											onClick={() => setPitchChannel("whatsapp")}
											className={`h-8 text-xs gap-1.5 ${pitchChannel === "whatsapp" ? "bg-emerald-600 hover:bg-emerald-700 text-white" : ""}`}
										>
											<Smartphone className="h-3.5 w-3.5" />
											WhatsApp Note
										</Button>
										<Button
											type="button"
											size="sm"
											variant={pitchChannel === "email" ? "default" : "outline"}
											onClick={() => setPitchChannel("email")}
											className={`h-8 text-xs gap-1.5 ${pitchChannel === "email" ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}`}
										>
											<Mail className="h-3.5 w-3.5" />
											Client Email
										</Button>
									</div>

									<Button
										type="button"
										size="sm"
										onClick={handleGeneratePitch}
										disabled={isGeneratingPitch}
										className="h-8 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-semibold gap-1.5 shadow-sm"
									>
										<Sparkles className="h-3.5 w-3.5" />
										<span>{isGeneratingPitch ? "Drafting Pitch..." : "Generate AI Pitch"}</span>
									</Button>
								</div>

								{/* Pitch Result Box */}
								{generatedPitch && (
									<div className="p-4 rounded-xl bg-background border border-emerald-500/40 space-y-3 relative shadow-inner">
										<div className="flex items-center justify-between border-b border-border/50 pb-2">
											<span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
												<CheckCircle2 className="h-3.5 w-3.5" />
												Draft Pitch Ready ({pitchChannel.toUpperCase()})
											</span>
											<Button
												size="sm"
												variant="outline"
												onClick={handleCopyPitch}
												className="h-7 text-xs gap-1 border-emerald-500/40 hover:bg-emerald-500/10 text-foreground"
											>
												{hasCopiedPitch ? (
													<>
														<Check className="h-3.5 w-3.5 text-emerald-400" />
														<span>Copied!</span>
													</>
												) : (
													<>
														<Copy className="h-3.5 w-3.5" />
														<span>Copy Script</span>
													</>
												)}
											</Button>
										</div>

										<p className="text-xs sm:text-sm text-foreground whitespace-pre-line leading-relaxed font-sans select-all pr-2">
											{generatedPitch}
										</p>

										{pitchChannel === "whatsapp" && (
											<div className="pt-2 flex justify-end">
												<Button
													size="sm"
													className="h-7 bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1"
													onClick={() => {
														const text = encodeURIComponent(generatedPitch);
														window.open(`https://wa.me/?text=${text}`, "_blank");
													}}
												>
													<Smartphone className="h-3 w-3" />
													<span>Send via WhatsApp</span>
												</Button>
											</div>
										)}
									</div>
								)}
							</CardContent>
						</Card>
					</TabsContent>
				</Tabs>
			</main>
		</div>
	);
}
