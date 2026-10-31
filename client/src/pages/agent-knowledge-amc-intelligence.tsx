import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
	Building2,
	ChevronLeft,
	Search,
	Sparkles,
	CheckCircle2,
	Layers,
	TrendingUp,
	Lightbulb,
	Copy,
	Check,
	ChevronRight,
	ExternalLink,
	ShieldCheck,
	Briefcase,
	Filter,
} from "lucide-react";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

interface AmcInsight {
	id: string;
	amcName: string;
	amcCode: string;
	shortName?: string;
	tier?: "mega_institutional" | "established_pillar" | "alpha_boutique" | "fintech_passive" | "gift_city_ifsc";
	rta?: string;
	aumBand?: string;
	title: string;
	author: string;
	authorDesignation: string;
	category: string;
	keyTakeaways: string[];
	sectorCalls: {
		overweight: string[];
		neutral: string[];
		underweight: string[];
	};
	macroIndicators: {
		gdpGrowthEstimate: string;
		rbiRateStance: string;
		tenYearGsecOutlook: string;
		crudeImpact: string;
	};
	advisoryTipForPartners: string;
	publishedDate: string;
	flagshipScheme?: {
		name: string;
		category: string;
		subCategory: string;
		benchmark: string;
	};
}

const TIER_FILTERS = [
	{ key: "all", label: "All AMCs", count: 52 },
	{ key: "mega_institutional", label: "Mega Institutional", count: 10 },
	{ key: "established_pillar", label: "Established Pillars", count: 14 },
	{ key: "alpha_boutique", label: "Alpha Boutiques", count: 16 },
	{ key: "fintech_passive", label: "Fintech Passives", count: 6 },
	{ key: "gift_city_ifsc", label: "GIFT City (IFSC)", count: 6 },
] as const;

export default function AgentKnowledgeAmcIntelligence() {
	const { toast } = useToast();
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedTier, setSelectedTier] = useState<string>("all");
	const [selectedAmcCode, setSelectedAmcCode] = useState<string>("HDFC_MF");
	const [copiedTip, setCopiedTip] = useState(false);

	const { data, isLoading } = useQuery<{
		success: boolean;
		count: number;
		insights: AmcInsight[];
	}>({
		queryKey: ["/api/knowledge-hub/amc/insights"],
	});

	const insights = data?.insights || [];

	const filteredInsights = useMemo(() => {
		return insights.filter((item) => {
			const matchesTier = selectedTier === "all" || item.tier === selectedTier;
			if (!matchesTier) return false;

			if (!searchQuery.trim()) return true;
			const q = searchQuery.toLowerCase().trim();
			return (
				item.amcName.toLowerCase().includes(q) ||
				item.shortName?.toLowerCase().includes(q) ||
				item.author.toLowerCase().includes(q) ||
				item.title.toLowerCase().includes(q) ||
				item.aumBand?.toLowerCase().includes(q) ||
				item.rta?.toLowerCase().includes(q)
			);
		});
	}, [insights, selectedTier, searchQuery]);

	// Keep selected AMC in sync with active filter
	const activeAmc = useMemo(() => {
		if (filteredInsights.length === 0) return null;
		const found = filteredInsights.find((i) => i.amcCode === selectedAmcCode);
		return found || filteredInsights[0];
	}, [filteredInsights, selectedAmcCode]);

	const handleCopyAdvisoryTip = (text: string) => {
		navigator.clipboard.writeText(text);
		setCopiedTip(true);
		toast({
			title: "Advisory Tip Copied",
			description: "Partner client advisory talking point copied to clipboard.",
		});
		setTimeout(() => setCopiedTip(false), 2000);
	};

	const getTierBadge = (tier?: string) => {
		switch (tier) {
			case "mega_institutional":
				return (
					<Badge className="bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200 border-blue-300 text-[10px] font-bold">
						Mega Institutional
					</Badge>
				);
			case "established_pillar":
				return (
					<Badge className="bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200 border-indigo-300 text-[10px] font-bold">
						Established Pillar
					</Badge>
				);
			case "alpha_boutique":
				return (
					<Badge className="bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border-amber-300 text-[10px] font-bold">
						Alpha Boutique
					</Badge>
				);
			case "fintech_passive":
				return (
					<Badge className="bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 border-emerald-300 text-[10px] font-bold">
						Fintech Passive
					</Badge>
				);
			case "gift_city_ifsc":
				return (
					<Badge className="bg-purple-100 text-purple-900 dark:bg-purple-950 dark:text-purple-200 border-purple-300 text-[10px] font-bold">
						GIFT City (IFSC)
					</Badge>
				);
			default:
				return null;
		}
	};

	return (
		<div className="p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
			{/* Top Header & Breadcrumbs */}
			<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
				<div className="flex items-center gap-3">
					<Link href="/agent/knowledge-hub">
						<Button
							variant="ghost"
							size="sm"
							className="text-muted-foreground hover:text-foreground -ml-2"
						>
							<ChevronLeft className="h-4 w-4 mr-1" />
							Back to Knowledge Hub
						</Button>
					</Link>
					<div className="h-4 w-px bg-border hidden sm:block" />
					<div>
						<div className="flex items-center gap-2">
							<Badge className="bg-purple-100 text-purple-900 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-300 dark:border-purple-700 text-xs font-semibold">
								<Building2 className="h-3 w-3 mr-1 text-purple-700 dark:text-purple-400" />
								SEBI & IFSCA Registered
							</Badge>
							<span className="text-xs text-muted-foreground">Updated Monthly</span>
						</div>
						<h1 className="text-2xl font-bold text-foreground mt-0.5">
							AMC Strategist Intelligence & CIO Perspectives
						</h1>
					</div>
				</div>

				<div className="flex items-center gap-2">
					<Link href="/agent/knowledge-hub/products">
						<Button variant="outline" size="sm" className="gap-1.5 text-xs font-medium">
							<Briefcase className="h-3.5 w-3.5" />
							Scheme Factsheets
						</Button>
					</Link>
				</div>
			</div>

			{/* Ecosystem Stat Cards */}
			<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
				{TIER_FILTERS.map((f) => {
					const isSelected = selectedTier === f.key;
					return (
						<button
							key={f.key}
							type="button"
							onClick={() => setSelectedTier(f.key)}
							className={`p-3 rounded-xl border text-left transition-all ${
								isSelected
									? "bg-purple-50 dark:bg-purple-950/40 border-purple-500 shadow-xs"
									: "bg-card border-border hover:border-purple-300 dark:hover:border-purple-800"
							}`}
						>
							<p className="text-[11px] font-semibold text-muted-foreground truncate">
								{f.label}
							</p>
							<p className={`text-xl font-bold mt-0.5 ${isSelected ? "text-purple-700 dark:text-purple-300" : "text-foreground"}`}>
								{f.count}
							</p>
						</button>
					);
				})}
			</div>

			{/* Main Master-Detail Full-Page Explorer */}
			<div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
				{/* Left Sidebar: AMC Directory List (4 cols) */}
				<div className="lg:col-span-4 space-y-3">
					<Card className="border-border">
						<CardHeader className="p-4 pb-3 space-y-3 border-b border-border">
							<div className="flex items-center justify-between">
								<CardTitle className="text-sm font-bold text-foreground flex items-center gap-1.5">
									<Filter className="h-4 w-4 text-purple-600 dark:text-purple-400" />
									Fund Houses ({filteredInsights.length})
								</CardTitle>
								{selectedTier !== "all" && (
									<button
										type="button"
										onClick={() => setSelectedTier("all")}
										className="text-[11px] text-purple-600 dark:text-purple-400 hover:underline font-semibold"
									>
										Clear Filter
									</button>
								)}
							</div>
							<div className="relative">
								<Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
								<Input
									type="search"
									placeholder="Search AMCs, CIOs, or AUM..."
									value={searchQuery}
									onChange={(e) => setSearchQuery(e.target.value)}
									className="pl-8 h-8 text-xs bg-muted/40 border-border"
								/>
							</div>
						</CardHeader>
						<CardContent className="p-2">
							<ScrollArea className="h-[650px] pr-2">
								{isLoading ? (
									<div className="py-12 text-center text-xs text-muted-foreground">
										Loading 52 registered AMCs...
									</div>
								) : filteredInsights.length === 0 ? (
									<div className="py-12 text-center text-xs text-muted-foreground">
										No fund houses found matching "{searchQuery}".
									</div>
								) : (
									<div className="space-y-1.5">
										{filteredInsights.map((item) => {
											const isSelected = activeAmc?.amcCode === item.amcCode;
											return (
												<button
													type="button"
													key={item.amcCode}
													onClick={() => setSelectedAmcCode(item.amcCode)}
													className={`w-full p-3 rounded-lg border text-left cursor-pointer transition-all ${
														isSelected
															? "bg-purple-50/80 dark:bg-purple-950/40 border-purple-500 shadow-xs"
															: "bg-card hover:bg-muted/50 border-border/70"
													}`}
												>
													<div className="flex items-start justify-between gap-2">
														<div>
															<h4 className={`text-xs font-bold leading-tight ${isSelected ? "text-purple-900 dark:text-purple-200" : "text-foreground"}`}>
																{item.amcName}
															</h4>
															<p className="text-[11px] text-muted-foreground mt-0.5 font-medium line-clamp-1">
																{item.author} • {item.authorDesignation}
															</p>
														</div>
														{isSelected && (
															<ChevronRight className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0 mt-0.5" />
														)}
													</div>

													<div className="flex flex-wrap items-center gap-1 mt-2">
														{getTierBadge(item.tier)}
														{item.rta && (
															<Badge variant="outline" className="text-[10px] font-medium py-0 px-1.5 text-muted-foreground border-border">
																{item.rta}
															</Badge>
														)}
														{item.aumBand && (
															<Badge variant="outline" className="text-[10px] font-semibold py-0 px-1.5 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800">
																{item.aumBand.split("(")[0].trim()}
															</Badge>
														)}
													</div>
												</button>
											);
										})}
									</div>
								)}
							</ScrollArea>
						</CardContent>
					</Card>
				</div>

				{/* Right Panel: Selected AMC Strategist Profile & Analysis (8 cols) */}
				<div className="lg:col-span-8 space-y-4">
					{activeAmc ? (
						<div className="space-y-4">
							{/* Header Profile Banner */}
							<Card className="border-border overflow-hidden">
								<div className="p-5 bg-gradient-to-r from-purple-500/10 via-blue-500/5 to-transparent border-b border-border">
									<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
										<div className="space-y-1.5">
											<div className="flex flex-wrap items-center gap-1.5">
												<Badge className="bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-200 border-blue-300 text-[10px] font-bold uppercase tracking-wider">
													{activeAmc.category.replace(/_/g, " ")}
												</Badge>
												{getTierBadge(activeAmc.tier)}
												{activeAmc.rta && (
													<Badge variant="outline" className="text-[10px] font-medium text-muted-foreground">
														RTA: {activeAmc.rta}
													</Badge>
												)}
												{activeAmc.aumBand && (
													<Badge variant="outline" className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800">
														AUM: {activeAmc.aumBand}
													</Badge>
												)}
											</div>
											<h2 className="text-xl font-bold text-foreground">
												{activeAmc.title}
											</h2>
											<p className="text-xs text-muted-foreground font-medium">
												Strategist: <span className="text-foreground font-semibold">{activeAmc.author}</span> ({activeAmc.authorDesignation}) • Published {activeAmc.publishedDate}
											</p>
										</div>

										<Link href="/agent/knowledge-hub/products">
											<Button size="sm" variant="outline" className="text-xs border-border shrink-0 shadow-xs">
												View Factsheets
												<ChevronRight className="h-3.5 w-3.5 ml-1" />
											</Button>
										</Link>
									</div>
								</div>

								{/* Flagship Scheme Spotlight */}
								{activeAmc.flagshipScheme && (
									<div className="px-5 py-3 bg-muted/30 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
										<div className="flex items-center gap-2">
											<Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-wider bg-indigo-100 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-200 border border-indigo-300">
												Flagship Strategy
											</Badge>
											<span className="font-bold text-foreground">
												{activeAmc.flagshipScheme.name}
											</span>
											<span className="text-muted-foreground hidden md:inline">
												• {activeAmc.flagshipScheme.subCategory} ({activeAmc.flagshipScheme.benchmark})
											</span>
										</div>
										<Link href="/agent/knowledge-hub/products">
											<span className="text-purple-600 dark:text-purple-400 font-semibold hover:underline flex items-center gap-1 cursor-pointer">
												Explore Product Card
												<ExternalLink className="h-3 w-3" />
											</span>
										</Link>
									</div>
								)}
							</Card>

							{/* Key Strategic Takeaways */}
							<Card className="border-border">
								<CardHeader className="p-4 pb-2">
									<CardTitle className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
										<Sparkles className="h-3.5 w-3.5 text-amber-500" />
										Key Strategic Takeaways
									</CardTitle>
								</CardHeader>
								<CardContent className="p-4 pt-1">
									<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
										{activeAmc.keyTakeaways.map((takeaway, idx) => (
											<div
												key={idx}
												className={`flex items-start gap-2.5 p-3 rounded-lg bg-muted/30 border border-border text-xs text-foreground font-medium shadow-xs ${
													activeAmc.keyTakeaways.length % 2 !== 0 && idx === activeAmc.keyTakeaways.length - 1 ? "md:col-span-2" : ""
												}`}
											>
												<CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
												<span className="leading-relaxed">{takeaway}</span>
											</div>
										))}
									</div>
								</CardContent>
							</Card>

							{/* Tactical Sector Calls */}
							<Card className="border-border">
								<CardHeader className="p-4 pb-2">
									<CardTitle className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
										<Layers className="h-3.5 w-3.5 text-blue-500" />
										Tactical Sector Calls
									</CardTitle>
								</CardHeader>
								<CardContent className="p-4 pt-1">
									<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
										{/* Overweight */}
										<div className="p-3.5 rounded-xl bg-emerald-50/90 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 shadow-xs">
											<Badge className="bg-emerald-100 text-emerald-900 dark:bg-emerald-900/80 dark:text-emerald-200 border border-emerald-400 dark:border-emerald-700 text-[10px] font-bold mb-2">
												OVERWEIGHT
											</Badge>
											<ul className="space-y-1.5 text-xs text-foreground font-medium">
												{activeAmc.sectorCalls.overweight.map((sec, i) => (
													<li key={i} className="flex items-center gap-1.5">
														<span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 shrink-0" />
														{sec}
													</li>
												))}
											</ul>
										</div>

										{/* Neutral */}
										<div className="p-3.5 rounded-xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 shadow-xs">
											<Badge className="bg-amber-100 text-amber-900 dark:bg-amber-900/80 dark:text-amber-200 border border-amber-400 dark:border-amber-700 text-[10px] font-bold mb-2">
												NEUTRAL
											</Badge>
											<ul className="space-y-1.5 text-xs text-foreground font-medium">
												{activeAmc.sectorCalls.neutral.map((sec, i) => (
													<li key={i} className="flex items-center gap-1.5">
														<span className="w-1.5 h-1.5 rounded-full bg-amber-600 dark:bg-amber-400 shrink-0" />
														{sec}
													</li>
												))}
											</ul>
										</div>

										{/* Underweight */}
										<div className="p-3.5 rounded-xl bg-rose-50/90 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 shadow-xs">
											<Badge className="bg-rose-100 text-rose-900 dark:bg-rose-900/80 dark:text-rose-200 border border-rose-400 dark:border-rose-700 text-[10px] font-bold mb-2">
												UNDERWEIGHT
											</Badge>
											<ul className="space-y-1.5 text-xs text-foreground font-medium">
												{activeAmc.sectorCalls.underweight.map((sec, i) => (
													<li key={i} className="flex items-center gap-1.5">
														<span className="w-1.5 h-1.5 rounded-full bg-rose-600 dark:bg-rose-400 shrink-0" />
														{sec}
													</li>
												))}
											</ul>
										</div>
									</div>
								</CardContent>
							</Card>

							{/* Macro Indicators */}
							<Card className="border-border">
								<CardHeader className="p-4 pb-2">
									<CardTitle className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
										<TrendingUp className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
										Macro & Rate Projections
									</CardTitle>
								</CardHeader>
								<CardContent className="p-4 pt-1">
									<div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
										<div className="p-3 rounded-lg bg-card border border-border shadow-xs">
											<p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">GDP Growth</p>
											<p className="text-xs font-bold text-foreground mt-0.5">{activeAmc.macroIndicators.gdpGrowthEstimate}</p>
										</div>
										<div className="p-3 rounded-lg bg-card border border-border shadow-xs">
											<p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">RBI Stance</p>
											<p className="text-xs font-bold text-foreground mt-0.5">{activeAmc.macroIndicators.rbiRateStance}</p>
										</div>
										<div className="p-3 rounded-lg bg-card border border-border shadow-xs">
											<p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">10Y G-Sec</p>
											<p className="text-xs font-bold text-foreground mt-0.5">{activeAmc.macroIndicators.tenYearGsecOutlook}</p>
										</div>
										<div className="p-3 rounded-lg bg-card border border-border shadow-xs">
											<p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Crude & FX</p>
											<p className="text-xs font-bold text-foreground mt-0.5">{activeAmc.macroIndicators.crudeImpact}</p>
										</div>
									</div>
								</CardContent>
							</Card>

							{/* Partner Advisory Tip */}
							<div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/70 border-l-4 border-l-emerald-600 border border-slate-300 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
								<div className="space-y-1">
									<div className="flex items-center gap-2">
										<Lightbulb className="h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
										<p className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
											Partner Client Advisory Takeaway
										</p>
									</div>
									<p className="text-xs text-slate-800 dark:text-slate-200 font-medium leading-relaxed pl-6">
										{activeAmc.advisoryTipForPartners}
									</p>
								</div>
								<Button
									size="sm"
									variant="outline"
									onClick={() => handleCopyAdvisoryTip(activeAmc.advisoryTipForPartners)}
									className="text-xs gap-1.5 shrink-0 bg-background hover:bg-muted"
								>
									{copiedTip ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
									{copiedTip ? "Copied" : "Copy Talking Point"}
								</Button>
							</div>

							{/* Regulatory Disclaimer */}
							<div className="flex items-center gap-2 text-[11px] text-muted-foreground p-3 rounded-lg bg-muted/20 border border-border">
								<ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
								<span>
									FASP-AI v1.0 Regulatory Notice: Strategist views reflect official fund manager and CIO disclosures for financial advisor decision-support. Mutual fund investments are subject to market risks. Read all scheme related documents carefully.
								</span>
							</div>
						</div>
					) : (
						<Card className="border-border p-12 text-center text-sm text-muted-foreground">
							Select a fund house from the directory to review macro calls and strategist perspectives.
						</Card>
					)}
				</div>
			</div>
		</div>
	);
}
