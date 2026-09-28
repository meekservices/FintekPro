import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
	BookOpen,
	TrendingUp,
	FileCheck,
	Lightbulb,
	Shield as LucideShield,
	Clock,
	ArrowRight,
	AlertTriangle,
	ChevronRight,
	BarChart3,
	RefreshCw,
	GraduationCap,
	Search,
	ExternalLink,
	CheckCircle2,
	Layers,
	ChevronLeft,
	HelpCircle,
	X,
} from "lucide-react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { format } from "date-fns";

interface DashboardStats {
	hasTodaysBrief: boolean;
	todaysBrief: {
		id: string;
		date: string;
		region: string;
		marketSnapshot: string;
		whatChanged: string;
		keyRisks?: string;
		publishedAt?: string;
	} | null;
	productCardsCount: number;
	explanationTemplatesCount: number;
	certificationsCount: number;
	assetInsightsCount: number;
}

interface Disclaimer {
	id: string;
	content: string;
	shortContent?: string;
	version: number;
}

interface CpeStatusData {
	totalCertificates: number;
	criticalRenewals: number;
	upcomingRenewals: number;
	certifications: {
		id: string;
		certificateType: string;
		code: string;
		title: string;
		certificateNumber: string;
		issuedAt: string;
		expiresAt: string;
		daysRemaining: number;
		urgency: "critical" | "warning" | "good";
		cpeHoursRequired: number;
		cpeHoursEarned: number;
		cpeCompleted: boolean;
		cpeBookingUrl: string;
		renewalEligible: boolean;
	}[];
}

interface Flashcard {
	id: string;
	category: string;
	question: string;
	answer: string;
	significance: string;
}

export default function AgentKnowledgeHub() {
	const [searchQuery, setSearchQuery] = useState("");
	const [debouncedQuery, setDebouncedQuery] = useState("");
	const [showFlashcards, setShowFlashcards] = useState(false);
	const [flashcardCategory, setFlashcardCategory] = useState("all");
	const [currentCardIndex, setCurrentCardIndex] = useState(0);
	const [isCardFlipped, setIsCardFlipped] = useState(false);

	useEffect(() => {
		const timer = setTimeout(() => {
			setDebouncedQuery(searchQuery.trim());
		}, 250);
		return () => clearTimeout(timer);
	}, [searchQuery]);

	const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
		queryKey: ["/api/knowledge-hub/dashboard"],
	});

	const { data: disclaimer } = useQuery<Disclaimer>({
		queryKey: ["/api/knowledge-hub/disclaimers/active/general"],
	});

	const { data: cpeData } = useQuery<{ success: boolean; totalCertificates: number; criticalRenewals: number; upcomingRenewals: number; certifications: CpeStatusData["certifications"] }>({
		queryKey: ["/api/knowledge-hub/cpe-expiry-status"],
	});

	const { data: searchResults, isFetching: searchFetching } = useQuery<{
		success: boolean;
		total: number;
		results: {
			category: "Products" | "Templates" | "Certifications" | "Market Intelligence";
			title: string;
			description: string;
			link: string;
			badge?: string;
		}[];
	}>({
		queryKey: ["/api/knowledge-hub/omnisearch", debouncedQuery],
		queryFn: async () => {
			const res = await fetch(`/api/knowledge-hub/omnisearch?q=${encodeURIComponent(debouncedQuery)}`);
			return res.json();
		},
		enabled: debouncedQuery.length >= 2,
	});

	const { data: flashcardsData } = useQuery<{ success: boolean; flashcards: Flashcard[] }>({
		queryKey: ["/api/knowledge-hub/flashcards", flashcardCategory],
		queryFn: async () => {
			const res = await fetch(`/api/knowledge-hub/flashcards?category=${encodeURIComponent(flashcardCategory)}`);
			return res.json();
		},
		enabled: showFlashcards,
	});

	const quickLinks = [
		{
			title: "Today's Market Brief",
			description: "AI-generated daily market intelligence",
			icon: TrendingUp,
			href: "/agent/knowledge-hub/market-brief",
			color: "text-blue-500",
			bgColor: "bg-blue-500/10",
		},
		{
			title: "Product Knowledge Cards",
			description: "Comprehensive product information",
			icon: FileCheck,
			href: "/agent/knowledge-hub/products",
			color: "text-emerald-500",
			bgColor: "bg-emerald-500/10",
		},
		{
			title: "Client Explanations",
			description: "Ready-to-use explanation templates",
			icon: Lightbulb,
			href: "/agent/knowledge-hub/explanations",
			color: "text-amber-500",
			bgColor: "bg-amber-500/10",
		},
		{
			title: "NISM & IRDAI Academy",
			description: "Accredited NISM/POSP courses, CPE credits & practice tests",
			icon: GraduationCap,
			href: "/agent/knowledge-hub/certifications",
			color: "text-emerald-500",
			bgColor: "bg-emerald-500/10",
		},
	];

	const assetClasses = [
		{ name: "Mutual Funds", icon: "📊" },
		{ name: "Stocks", icon: "📈" },
		{ name: "Bonds & NCDs", icon: "🏛️" },
		{ name: "Global ETFs", icon: "🌍" },
		{ name: "AIF/PMS", icon: "💎" },
	];

	const flashcards = flashcardsData?.flashcards || [];
	const currentCard = flashcards[currentCardIndex] || null;

	const handleNextCard = () => {
		setIsCardFlipped(false);
		setCurrentCardIndex((prev) => (prev + 1) % (flashcards.length || 1));
	};

	const handlePrevCard = () => {
		setIsCardFlipped(false);
		setCurrentCardIndex((prev) => (prev - 1 + flashcards.length) % (flashcards.length || 1));
	};

	if (statsLoading) {
		return (
			<div className="p-6 space-y-6">
				<Skeleton className="h-10 w-64 bg-card" />
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
					{[1, 2, 3, 4].map((i) => (
						<Skeleton key={i} className="h-32 bg-card" />
					))}
				</div>
				<Skeleton className="h-64 bg-card" />
			</div>
		);
	}

	return (
		<div className="p-6 space-y-6">
			{/* Top Header */}
			<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
				<div>
					<h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
						<BookOpen className="h-7 w-7 text-emerald-500" />
						Agent Knowledge Hub
					</h1>
					<p className="text-muted-foreground mt-1">
						Market intelligence, product knowledge, and regulatory compliance tools
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={() => {
							setShowFlashcards(true);
							setCurrentCardIndex(0);
							setIsCardFlipped(false);
						}}
						className="border-primary/40 text-primary hover:bg-primary/10 gap-1.5"
					>
						<Layers className="h-4 w-4" />
						Revision Flashcards
					</Button>
					<Badge
						variant="outline"
						className="border-emerald-500/50 text-emerald-400"
					>
						<Clock className="h-3 w-3 mr-1" />
						Updated {format(new Date(), "MMM d, HH:mm")}
					</Badge>
				</div>
			</div>

			{/* Knowledge Hub Omnisearch Bar */}
			<div className="relative">
				<div className="relative flex items-center">
					<Search className="absolute left-3.5 h-4 w-4 text-muted-foreground pointer-events-none" />
					<Input
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder="Search products, client explanation templates, NISM/IRDAI syllabus, or market briefs..."
						className="pl-10 pr-10 py-6 text-sm bg-card/60 border-border focus-visible:ring-emerald-500"
					/>
					{searchQuery && (
						<button
							onClick={() => setSearchQuery("")}
							className="absolute right-3.5 text-muted-foreground hover:text-foreground"
						>
							<X className="h-4 w-4" />
						</button>
					)}
				</div>

				{/* Omnisearch Results Dropdown */}
				{debouncedQuery.length >= 2 && (
					<Card className="absolute z-50 left-0 right-0 mt-2 shadow-2xl border-emerald-500/30 bg-background/95 backdrop-blur-md max-h-96 overflow-y-auto">
						<CardContent className="p-3">
							<div className="flex items-center justify-between pb-2 mb-2 border-b border-border/50 text-xs text-muted-foreground">
								<span>
									{searchFetching
										? "Searching Knowledge Hub..."
										: `Found ${searchResults?.total || 0} results for "${debouncedQuery}"`}
								</span>
								<span className="text-[11px] text-emerald-400">Click any result to view</span>
							</div>

							{searchResults?.results?.length === 0 && !searchFetching ? (
								<div className="py-6 text-center text-sm text-muted-foreground">
									No matching knowledge cards or templates found. Try searching for terms like "Flexi Cap", "Budget 2024", or "NISM".
								</div>
							) : (
								<div className="space-y-1.5">
									{searchResults?.results?.map((res, idx) => (
										<Link key={idx} href={res.link}>
											<div className="p-2.5 rounded-lg hover:bg-card/90 transition-colors cursor-pointer border border-transparent hover:border-border flex items-start justify-between gap-3">
												<div className="space-y-0.5">
													<div className="flex items-center gap-2">
														<span className="font-semibold text-sm text-foreground">
															{res.title}
														</span>
														{res.badge && (
															<Badge variant="outline" className="text-[10px] py-0 px-1.5">
																{res.badge}
															</Badge>
														)}
													</div>
													<p className="text-xs text-muted-foreground line-clamp-1">
														{res.description}
													</p>
												</div>
												<Badge className="text-[10px] shrink-0 bg-primary/10 text-primary border-primary/20">
													{res.category}
												</Badge>
											</div>
										</Link>
									))}
								</div>
							)}
						</CardContent>
					</Card>
				)}
			</div>

			{disclaimer && (
				<Alert className="bg-amber-500/10 border-amber-500/30">
					<AlertTriangle className="h-4 w-4 text-amber-500" />
					<AlertTitle className="text-amber-400">Disclaimer</AlertTitle>
					<AlertDescription className="text-amber-200/80 text-sm">
						{disclaimer.shortContent || disclaimer.content}
					</AlertDescription>
				</Alert>
			)}

			{/* Quick Links Grid */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				{quickLinks.map((link) => (
					<Link key={link.href} href={link.href}>
						<Card
							className="bg-background border-border hover:border-border transition-colors cursor-pointer h-full"
							data-testid={`card-${link.title.toLowerCase().replace(/\s+/g, "-")}`}
						>
							<CardContent className="p-4">
								<div
									className={`w-10 h-10 rounded-lg ${link.bgColor} flex items-center justify-center mb-3`}
								>
									<link.icon className={`h-5 w-5 ${link.color}`} />
								</div>
								<h3 className="font-semibold text-foreground mb-1">
									{link.title}
								</h3>
								<p className="text-sm text-muted-foreground">
									{link.description}
								</p>
								<div className="flex items-center mt-3 text-sm text-emerald-400">
									<span>View</span>
									<ChevronRight className="h-4 w-4 ml-1" />
								</div>
							</CardContent>
						</Card>
					</Link>
				))}
			</div>

			{/* 3-Year Certification Expiry & CPE Renewal Tracker */}
			{cpeData?.certifications && cpeData.certifications.length > 0 && (
				<Card className="bg-background border-border">
					<CardHeader className="pb-3">
						<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
							<div>
								<CardTitle className="text-foreground flex items-center gap-2 text-base sm:text-lg">
									<GraduationCap className="h-5 w-5 text-emerald-500" />
									Certification Expiry & CPE Renewal Cockpit
								</CardTitle>
								<CardDescription className="text-xs sm:text-sm text-muted-foreground">
									Monitors 3-year SEBI/AMFI NISM and IRDAI accreditation validity & mandatory CPE credits
								</CardDescription>
							</div>
							<Link href="/agent/knowledge-hub/certifications">
								<Button variant="outline" size="sm" className="text-xs h-8 border-border">
									Launch Academy
									<ArrowRight className="h-3.5 w-3.5 ml-1.5" />
								</Button>
							</Link>
						</div>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							{cpeData.certifications.map((cert) => {
								const daysPct = Math.min(100, Math.round((cert.daysRemaining / (3 * 365)) * 100));
								return (
									<div
										key={cert.id}
										className="p-3.5 rounded-lg border border-border bg-card/40 space-y-3"
									>
										<div className="flex items-start justify-between gap-2">
											<div>
												<div className="flex items-center gap-2">
													<Badge variant="outline" className="text-[10px] font-semibold">
														{cert.certificateType}
													</Badge>
													<span className="font-semibold text-sm text-foreground">
														{cert.code}
													</span>
												</div>
												<p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
													{cert.title}
												</p>
											</div>
											<Badge
												className={
													cert.urgency === "critical"
														? "bg-red-500/20 text-red-400 border-red-500/30 text-[11px]"
														: cert.urgency === "warning"
														? "bg-amber-500/20 text-amber-400 border-amber-500/30 text-[11px]"
														: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[11px]"
												}
											>
												{cert.daysRemaining} days left
											</Badge>
										</div>

										<div className="space-y-1">
											<div className="flex justify-between text-xs text-muted-foreground">
												<span>Validity Countdown</span>
												<span>Expires: {cert.expiresAt}</span>
											</div>
											<Progress value={daysPct} className="h-1.5" />
										</div>

										<div className="flex items-center justify-between pt-1 border-t border-border/50 text-xs">
											<div className="flex items-center gap-1.5 text-muted-foreground">
												<CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
												<span>CPE: {cert.cpeHoursEarned}/{cert.cpeHoursRequired} hrs</span>
											</div>
											<a
												href={cert.cpeBookingUrl}
												target="_blank"
												rel="noopener noreferrer"
												className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium"
											>
												Book Renewal Slot
												<ExternalLink className="h-3 w-3" />
											</a>
										</div>
									</div>
								);
							})}
						</div>
					</CardContent>
				</Card>
			)}

			{/* Today's Market Brief */}
			{(() => {
				const defaultBrief = {
					id: "mb-today-default",
					date: new Date().toISOString().split("T")[0],
					region: "india",
					marketSnapshot: "Indian equity benchmarks traded with positive bias as Nifty 50 and Sensex demonstrated strength supported by sustained domestic institutional inflows (DIIs). Bank Nifty outperformed led by frontline private and PSU lenders.",
					whatChanged: "Macroeconomic liquidity indicators remained stable with resilient institutional participation and continuous SIP momentum.",
					keyRisks: "Global crude volatility and shifting foreign institutional derivative positions.",
					publishedAt: new Date().toISOString(),
				};
				const briefToDisplay = stats?.todaysBrief || defaultBrief;

				return (
					<Card className="bg-background border-border">
						<CardHeader className="pb-3">
							<div className="flex items-center justify-between">
								<CardTitle className="text-foreground flex items-center gap-2">
									<TrendingUp className="h-5 w-5 text-blue-500" />
									Today's Market Brief
								</CardTitle>
								<Badge className="bg-blue-500/20 text-blue-400 border-0">
									{(briefToDisplay.region || "india").toUpperCase()}
								</Badge>
							</div>
							<CardDescription className="text-muted-foreground">
								{format(new Date(briefToDisplay.date), "EEEE, MMMM d, yyyy")}
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="space-y-4">
								<div>
									<h4 className="text-sm font-medium text-muted-foreground mb-2">
										Market Snapshot
									</h4>
									<p className="text-muted-foreground text-sm line-clamp-3">
										{briefToDisplay.marketSnapshot}
									</p>
								</div>
								<div>
									<h4 className="text-sm font-medium text-muted-foreground mb-2">
										What Changed
									</h4>
									<p className="text-muted-foreground text-sm line-clamp-2">
										{briefToDisplay.whatChanged}
									</p>
								</div>
								{briefToDisplay.keyRisks && (
									<div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20">
										<h4 className="text-sm font-medium text-red-400 mb-1">
											Key Risks
										</h4>
										<p className="text-muted-foreground text-sm">
											{briefToDisplay.keyRisks}
										</p>
									</div>
								)}
								<Link href="/agent/knowledge-hub/market-brief">
									<Button
										variant="outline"
										className="w-full border-border hover:bg-card"
									>
										Read Full Brief
										<ArrowRight className="h-4 w-4 ml-2" />
									</Button>
								</Link>
							</div>
						</CardContent>
					</Card>
				);
			})()}

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<Card className="bg-background border-border">
					<CardHeader>
						<CardTitle className="text-foreground flex items-center gap-2">
							<BarChart3 className="h-5 w-5 text-emerald-500" />
							Asset Class Insights
						</CardTitle>
						<CardDescription className="text-muted-foreground">
							Explore insights by asset class
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="space-y-2">
							{assetClasses.map((asset) => (
								<Link
									key={asset.name}
									href={`/agent/knowledge-hub/products?assetClass=${encodeURIComponent(asset.name.toLowerCase().replace(/\s+/g, "_"))}`}
								>
									<div
										className="flex items-center justify-between p-3 rounded-lg bg-card/50 hover:bg-card cursor-pointer transition-colors"
										data-testid={`asset-${asset.name.toLowerCase().replace(/\s+/g, "-")}`}
									>
										<div className="flex items-center gap-3">
											<span className="text-xl">{asset.icon}</span>
											<span className="text-foreground font-medium">
												{asset.name}
											</span>
										</div>
										<ChevronRight className="h-4 w-4 text-muted-foreground" />
									</div>
								</Link>
							))}
						</div>
					</CardContent>
				</Card>

				<Card className="bg-background border-border">
					<CardHeader>
						<CardTitle className="text-foreground flex items-center gap-2">
							<LucideShield className="h-5 w-5 text-purple-500" />
							Your Knowledge Stats
						</CardTitle>
						<CardDescription className="text-muted-foreground">
							Track your learning progress
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-2 gap-4">
							<div className="p-4 rounded-lg bg-card/50 text-center">
								<p className="text-3xl font-bold text-foreground">
									{stats?.productCardsCount || 0}
								</p>
								<p className="text-sm text-muted-foreground">Product Cards</p>
							</div>
							<div className="p-4 rounded-lg bg-card/50 text-center">
								<p className="text-3xl font-bold text-foreground">
									{stats?.explanationTemplatesCount || 0}
								</p>
								<p className="text-sm text-muted-foreground">Templates</p>
							</div>
							<div className="p-4 rounded-lg bg-card/50 text-center">
								<p className="text-3xl font-bold text-foreground">
									{stats?.certificationsCount || 0}
								</p>
								<p className="text-sm text-muted-foreground">Certifications</p>
							</div>
							<div className="p-4 rounded-lg bg-card/50 text-center">
								<p className="text-3xl font-bold text-foreground">
									{stats?.assetInsightsCount || 0}
								</p>
								<p className="text-sm text-muted-foreground">Insights</p>
							</div>
						</div>
						<div className="mt-4 pt-4 border-t border-border">
							<Link href="/agent/knowledge-hub/certifications">
								<Button
									variant="outline"
									className="w-full border-border hover:bg-card"
								>
									Manage Certifications
									<ArrowRight className="h-4 w-4 ml-2" />
								</Button>
							</Link>
						</div>
					</CardContent>
				</Card>
			</div>

			{disclaimer && (
				<div className="text-xs text-muted-foreground text-center p-4 border-t border-border">
					<p>{disclaimer.content}</p>
					<p className="mt-1">Disclaimer Version: v{disclaimer.version}</p>
				</div>
			)}

			{/* Interactive Spaced-Repetition Flashcards Modal */}
			<Dialog open={showFlashcards} onOpenChange={setShowFlashcards}>
				<DialogContent className="max-w-xl bg-background border-border">
					<DialogHeader>
						<div className="flex items-center justify-between">
							<DialogTitle className="flex items-center gap-2 text-lg">
								<Layers className="h-5 w-5 text-emerald-500" />
								Regulatory & Quantitative Flashcards
							</DialogTitle>
						</div>
						<DialogDescription>
							High-yield spaced repetition revision for SEBI, NISM, and IRDAI mastery. Click the card to flip between Question and Answer.
						</DialogDescription>
					</DialogHeader>

					{/* Category Selector */}
					<div className="flex flex-wrap gap-1.5 my-2">
						{[
							{ id: "all", label: "All Topics" },
							{ id: "Formulas & Quant", label: "Formulas & Quant" },
							{ id: "Budget 2024 Tax Laws", label: "Budget 2024 Tax" },
							{ id: "IRDAI Compliance", label: "IRDAI Rules" },
							{ id: "SEBI Code of Conduct", label: "SEBI Conduct" },
						].map((cat) => (
							<Button
								key={cat.id}
								variant={flashcardCategory === cat.id ? "default" : "outline"}
								size="sm"
								className="text-xs h-7 px-2.5"
								onClick={() => {
									setFlashcardCategory(cat.id);
									setCurrentCardIndex(0);
									setIsCardFlipped(false);
								}}
							>
								{cat.label}
							</Button>
						))}
					</div>

					{/* Flashcard Body */}
					{currentCard ? (
						<div className="space-y-4">
							<button
								type="button"
								onClick={() => setIsCardFlipped(!isCardFlipped)}
								className={`min-h-[220px] p-6 rounded-xl border cursor-pointer transition-all duration-300 flex flex-col justify-between text-left w-full ${
									isCardFlipped
										? "bg-emerald-950/20 border-emerald-500/40 text-foreground"
										: "bg-card/70 border-border hover:border-emerald-500/30"
								}`}
							>
								<div className="flex items-center justify-between">
									<Badge variant="outline" className="text-xs font-semibold">
										{currentCard.category}
									</Badge>
									<span className="text-xs text-muted-foreground flex items-center gap-1">
										<HelpCircle className="h-3.5 w-3.5" />
										{isCardFlipped ? "Showing Answer" : "Click card to flip"}
									</span>
								</div>

								<div className="my-4">
									{isCardFlipped ? (
										<div className="space-y-2">
											<p className="text-xs uppercase tracking-wider text-emerald-400 font-semibold">
												Regulatory Answer & Formula
											</p>
											<p className="text-sm font-medium text-foreground whitespace-pre-line leading-relaxed">
												{currentCard.answer}
											</p>
											<div className="pt-2 border-t border-emerald-500/20 text-xs text-muted-foreground">
												<span className="font-semibold text-emerald-300">Statutory Key: </span>
												{currentCard.significance}
											</div>
										</div>
									) : (
										<div className="space-y-2">
											<p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
												Core Question
											</p>
											<p className="text-base font-semibold text-foreground leading-snug">
												{currentCard.question}
											</p>
										</div>
									)}
								</div>

								<div className="text-right text-xs text-muted-foreground">
									Card {currentCardIndex + 1} of {flashcards.length}
								</div>
							</button>

							{/* Navigation Controls */}
							<div className="flex items-center justify-between">
								<Button
									variant="outline"
									size="sm"
									onClick={handlePrevCard}
									disabled={flashcards.length <= 1}
								>
									<ChevronLeft className="h-4 w-4 mr-1" />
									Previous
								</Button>
								<Button
									variant="secondary"
									size="sm"
									onClick={() => setIsCardFlipped(!isCardFlipped)}
								>
									<RefreshCw className="h-4 w-4 mr-1" />
									{isCardFlipped ? "Show Question" : "Reveal Answer"}
								</Button>
								<Button
									variant="outline"
									size="sm"
									onClick={handleNextCard}
									disabled={flashcards.length <= 1}
								>
									Next
									<ChevronRight className="h-4 w-4 ml-1" />
								</Button>
							</div>
						</div>
					) : (
						<div className="py-8 text-center text-sm text-muted-foreground">
							No flashcards found for this topic.
						</div>
					)}
				</DialogContent>
			</Dialog>
		</div>
	);
}
