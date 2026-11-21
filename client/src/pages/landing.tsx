import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
	ArrowRight,
	Shield,
	TrendingUp,
	BarChart3,
	Globe,
	CheckCircle,
	Coins,
	Receipt,
	Building,
	Sparkles,
	Lock,
	PieChart,
	Menu,
	X,
	Calculator,
	Activity,
	Layers,
	Briefcase,
	GraduationCap,
	Users,
	FileText,
	CheckCircle2,
	ExternalLink,
	Smartphone,
	Download,
	QrCode,
	Fingerprint,
	Bell,
	EyeOff,
	Camera,
	Send,
	Apple,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PlatformStats {
	activeUsers?: string;
	portfolioValue?: string;
	mutualFundsCount?: string;
	bondsCount?: string;
	stocksCount?: string;
	activeIpos?: string;
	investmentOptions?: string;
}

export default function LandingPage() {
	const { isAuthenticated, isLoading, user } = useAuth();
	const [, setLocation] = useLocation();
	const [isScrolled, setIsScrolled] = useState(false);
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

	// Fetch real-time platform metrics from backend API
	const { data: stats } = useQuery<PlatformStats>({
		queryKey: ["/api/platform/stats"],
		staleTime: 5 * 60 * 1000,
	});

	useEffect(() => {
		const handleScroll = () => {
			setIsScrolled(window.scrollY > 40);
		};
		window.addEventListener("scroll", handleScroll);
		return () => window.removeEventListener("scroll", handleScroll);
	}, []);

	useEffect(() => {
		if (!isLoading && isAuthenticated && user) {
			const isDataUser = (u: unknown): u is { data: { roles?: string[] } } =>
				typeof u === "object" && u !== null && "data" in u;

			const isDirectUser = (u: unknown): u is { roles?: string[] } =>
				typeof u === "object" && u !== null && "roles" in u;

			let actualRoles: string[] = [];
			if (isDataUser(user) && user.data.roles) {
				actualRoles = user.data.roles;
			} else if (isDirectUser(user) && user.roles) {
				actualRoles = user.roles;
			}

			if (actualRoles.includes("agent")) {
				setLocation("/agent");
			} else if (
				actualRoles.includes("admin") ||
				actualRoles.includes("superadmin")
			) {
				setLocation("/admin");
			} else if (actualRoles.includes("treasury_client")) {
				setLocation("/treasury-dashboard");
			} else if (actualRoles.includes("family_office")) {
				setLocation("/families");
			} else {
				setLocation("/dashboard"); // Standard Retail Client Dashboard
			}
		}
	}, [isAuthenticated, isLoading, user, setLocation]);

	// Don't show landing page flash if authenticated
	if (isLoading || isAuthenticated) return null;

	const products = [
		{
			title: "Direct Mutual Funds",
			description:
				"Invest in 14,000+ direct mutual fund schemes with 0% commission and automated SIPs.",
			icon: Coins,
			badge: "0% Commission",
			href: "/mutual-funds",
			color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
		},
		{
			title: "Bonds & Sovereign Debt",
			description:
				"Access G-Secs, State Development Loans, and AAA rated Corporate NCDs with transparent YTM.",
			icon: Receipt,
			badge: "Fixed Yield",
			href: "/bonds",
			color: "text-blue-500 bg-blue-500/10 border-blue-500/20",
		},
		{
			title: "Unlisted & Pre-IPO",
			description:
				"Curated private market equities and late-stage unicorn cap table shares with demat delivery.",
			icon: Sparkles,
			badge: "Exclusive",
			href: "/unlisted",
			color: "text-purple-500 bg-purple-500/10 border-purple-500/20",
		},
		{
			title: "Public IPO Center",
			description:
				"Instant UPI bidding for Mainboard and SME public offerings with live Grey Market Premium tracking.",
			icon: Building,
			badge: "Live GMP",
			href: "/ipo",
			color: "text-amber-500 bg-amber-500/10 border-amber-500/20",
		},
		{
			title: "REITs & InvITs",
			description:
				"High dividend distribution assets in commercial real estate and infrastructure trusts.",
			icon: Layers,
			badge: "High Yield",
			href: "/reit-invit",
			color: "text-cyan-500 bg-cyan-500/10 border-cyan-500/20",
		},
		{
			title: "Financial Planning",
			description:
				"25+ comprehensive calculators for SIP, Step-Up, Capital Gains, SWP, and Retirement planning.",
			icon: Calculator,
			badge: "Free Tools",
			href: "/calculators",
			color: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20",
		},
	];

	return (
		<div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/30">
			{/* Navigation Header */}
			<nav
				className={cn(
					"fixed top-0 w-full z-50 transition-all duration-300 border-b",
					isScrolled
						? "bg-background/90 backdrop-blur-md border-border shadow-sm py-3"
						: "bg-transparent border-transparent py-5",
				)}
			>
				<div className="container mx-auto px-6 flex items-center justify-between">
					<button
						type="button"
						className="flex items-center gap-2.5 group cursor-pointer text-left bg-transparent border-none p-0"
						onClick={() => setLocation("/")}
					>
						<div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
							<Shield className="w-6 h-6 text-primary group-hover:scale-110 transition-transform duration-300" />
						</div>
						<div className="flex flex-col">
							<span className="font-bold text-2xl tracking-tight bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
								FintekPro
							</span>
							<span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-widest -mt-1">
								Wealth Management
							</span>
						</div>
					</button>

					{/* Desktop Nav Links */}
					<div className="hidden md:flex items-center gap-6">
						<a
							href="#features"
							className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
						>
							Features
						</a>
						<a
							href="#products"
							className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
						>
							Products
						</a>
						<a
							href="#ecosystem"
							className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
						>
							Ecosystem
						</a>
						<a
							href="#mobile-apps"
							className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"
						>
							<Smartphone className="w-3.5 h-3.5 text-primary" />
							Mobile App
						</a>
						<a
							href="#ai-decision-support"
							className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
						>
							FASP-AI
						</a>
						<a
							href="/pricing"
							onClick={(e) => {
								e.preventDefault();
								setLocation("/pricing");
							}}
							className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
						>
							Pricing
						</a>

						<Button
							size="sm"
							variant="outline"
							className="h-8 text-xs rounded-full border-primary/30 text-primary hover:bg-primary/10 gap-1.5"
							onClick={() => setLocation("/tools/portfolio-xray")}
						>
							<Sparkles className="w-3.5 h-3.5 text-primary" />
							Portfolio X-Ray
						</Button>

						<div className="flex items-center gap-3 pl-3 border-l border-border/60">
							<Button
								onClick={() => setLocation("/auth")}
								variant="ghost"
								className="text-sm font-medium"
							>
								Log In
							</Button>
							<Button
								onClick={() => setLocation("/auth?mode=register")}
								className="text-sm font-medium shadow-lg shadow-primary/20 rounded-full px-5"
							>
								Get Started <ArrowRight className="w-4 h-4 ml-1.5" />
							</Button>
						</div>
					</div>

					{/* Mobile Menu Trigger */}
					<div className="md:hidden flex items-center gap-2">
						<Button
							onClick={() => setLocation("/auth")}
							size="sm"
							variant="outline"
							className="rounded-full text-xs px-3"
						>
							Log In
						</Button>
						<Button
							variant="ghost"
							size="icon"
							onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
							aria-label="Toggle navigation menu"
						>
							{mobileMenuOpen ? (
								<X className="w-6 h-6" />
							) : (
								<Menu className="w-6 h-6" />
							)}
						</Button>
					</div>
				</div>

				{/* Mobile Drawer */}
				{mobileMenuOpen && (
					<div className="md:hidden bg-background/95 backdrop-blur-xl border-b border-border px-6 py-6 space-y-4 animate-in slide-in-from-top-4 duration-200">
						<div className="flex flex-col space-y-3">
							<a
								href="#features"
								onClick={() => setMobileMenuOpen(false)}
								className="text-base font-medium text-muted-foreground hover:text-primary py-1"
							>
								Features
							</a>
							<a
								href="#products"
								onClick={() => setMobileMenuOpen(false)}
								className="text-base font-medium text-muted-foreground hover:text-primary py-1"
							>
								Products
							</a>
							<a
								href="#ecosystem"
								onClick={() => setMobileMenuOpen(false)}
								className="text-base font-medium text-muted-foreground hover:text-primary py-1"
							>
								Ecosystem Portals
							</a>
							<a
								href="#mobile-apps"
								onClick={() => setMobileMenuOpen(false)}
								className="text-base font-medium text-muted-foreground hover:text-primary py-1 flex items-center gap-2"
							>
								<Smartphone className="w-4 h-4 text-primary" />
								Mobile Apps (iOS & Android)
							</a>
							<a
								href="#ai-decision-support"
								onClick={() => setMobileMenuOpen(false)}
								className="text-base font-medium text-muted-foreground hover:text-primary py-1"
							>
								FASP-AI Decision Support
							</a>
							<a
								href="#about"
								onClick={() => setMobileMenuOpen(false)}
								className="text-base font-medium text-muted-foreground hover:text-primary py-1"
							>
								About Us & Compliance
							</a>
							<button
								type="button"
								onClick={() => {
									setMobileMenuOpen(false);
									setLocation("/pricing");
								}}
								className="text-base font-medium text-muted-foreground hover:text-primary py-1 text-left bg-transparent border-none p-0 cursor-pointer"
							>
								Pricing
							</button>
						</div>
						<div className="pt-4 border-t border-border flex flex-col gap-2.5">
							<Button
								onClick={() => {
									setMobileMenuOpen(false);
									setLocation("/auth?mode=register");
								}}
								className="w-full rounded-full"
							>
								Create Free Account <ArrowRight className="w-4 h-4 ml-2" />
							</Button>
						</div>
					</div>
				)}
			</nav>

			{/* Hero Section */}
			<section className="relative pt-32 pb-20 md:pt-44 md:pb-32 overflow-hidden">
				{/* Background ambient glow */}
				<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/15 rounded-full blur-[140px] opacity-60 pointer-events-none" />
				<div className="absolute top-10 right-10 w-[500px] h-[500px] bg-blue-500/10 rounded-full blur-[120px] opacity-40 pointer-events-none" />

				<div className="container mx-auto px-6 relative z-10 text-center">
					<div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary font-medium text-sm mb-6">
						<Sparkles className="w-4 h-4 text-primary" />
						<span>SEBI Regulated Financial Grade Platform • FASP-AI v1.0</span>
					</div>

					<h1 className="text-4xl sm:text-6xl md:text-7xl font-extrabold tracking-tight mb-6 leading-[1.1] max-w-4xl mx-auto bg-gradient-to-br from-foreground via-foreground/90 to-foreground/60 bg-clip-text text-transparent">
						Intelligent Wealth Management for the Modern Investor.
					</h1>

					<p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto font-light leading-relaxed">
						Consolidate your multi-asset portfolio, access curated bonds and
						unlisted shares, and leverage transparent AI decision support to
						compound your wealth securely.
					</p>

					<div className="flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto sm:max-w-none">
						<Button
							onClick={() => setLocation("/auth?mode=register")}
							size="lg"
							className="w-full sm:w-auto text-base h-13 px-8 rounded-full shadow-xl shadow-primary/25 hover:scale-105 transition-all duration-300"
						>
							Start Investing Now <ArrowRight className="w-5 h-5 ml-2" />
						</Button>
						<Button
							onClick={() => {
								const productsElem = document.getElementById("products");
								productsElem?.scrollIntoView({ behavior: "smooth" });
							}}
							variant="outline"
							size="lg"
							className="w-full sm:w-auto text-base h-13 px-8 rounded-full border-2 hover:bg-muted/50 transition-all duration-300"
						>
							Explore Products
						</Button>
					</div>

					{/* Interactive High-Conversion Lead Magnet: Portfolio X-Ray */}
					<div className="mt-8 p-3.5 sm:p-4 rounded-2xl bg-card/80 border border-primary/25 max-w-xl mx-auto shadow-md backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
						<div className="flex items-center gap-3">
							<div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
								<Activity className="w-5 h-5 text-primary" />
							</div>
							<div>
								<div className="text-sm font-semibold text-foreground flex items-center gap-2">
									<span>Free AI Portfolio X-Ray</span>
									<Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 font-bold">Instant Audit</Badge>
								</div>
								<div className="text-xs text-muted-foreground mt-0.5">Audit mutual funds, stocks, sector overlap & risk concentration in 30s</div>
							</div>
						</div>
						<Button
							size="sm"
							className="text-xs rounded-full shrink-0 h-8 px-4 font-semibold shadow-sm"
							onClick={() => setLocation("/tools/portfolio-xray")}
						>
							Run Free Audit →
						</Button>
					</div>

					{/* Live Platform Stats Pill Bar */}
					<div className="mt-12 inline-flex flex-wrap items-center justify-center gap-6 sm:gap-10 py-3 px-6 rounded-2xl bg-card/60 backdrop-blur-md border border-border/60 shadow-sm text-sm">
						<div className="flex items-center gap-2">
							<div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
							<span className="text-muted-foreground">Investment Options:</span>
							<span className="font-bold text-foreground">
								{stats?.investmentOptions || "14,000+"}
							</span>
						</div>
						<div className="hidden sm:block w-px h-4 bg-border" />
						<div className="flex items-center gap-2">
							<span className="text-muted-foreground">Stocks & Indices:</span>
							<span className="font-bold text-foreground">
								{stats?.stocksCount || "2,800+"}
							</span>
						</div>
						<div className="hidden sm:block w-px h-4 bg-border" />
						<div className="flex items-center gap-2">
							<span className="text-muted-foreground">Fixed Income & Bonds:</span>
							<span className="font-bold text-foreground">
								{stats?.bondsCount || "100+"}
							</span>
						</div>
						<div className="hidden sm:block w-px h-4 bg-border" />
						<div className="flex items-center gap-2">
							<span className="text-muted-foreground">Direct Commission:</span>
							<span className="font-bold text-emerald-600 dark:text-emerald-400">
								0% Free
							</span>
						</div>
					</div>

					{/* High-Fidelity Interactive Dashboard Preview Mockup */}
					<div className="mt-14 relative mx-auto max-w-5xl">
						<div className="relative rounded-2xl md:rounded-[28px] overflow-hidden border border-border/70 shadow-2xl bg-card/80 backdrop-blur-xl transition-all duration-500">
							{/* Mockup Window Header */}
							<div className="h-11 border-b border-border/70 flex items-center justify-between px-4 bg-muted/40">
								<div className="flex items-center gap-2">
									<div className="w-3 h-3 rounded-full bg-red-500/80" />
									<div className="w-3 h-3 rounded-full bg-yellow-500/80" />
									<div className="w-3 h-3 rounded-full bg-emerald-500/80" />
								</div>
								<div className="flex items-center gap-3 text-xs text-muted-foreground">
									<span className="flex items-center gap-1.5 font-medium">
										<Shield className="w-3.5 h-3.5 text-emerald-500" />
										portal.fintekpro.com/dashboard
									</span>
								</div>
								<div className="flex items-center gap-2">
									<Badge
										variant="outline"
										className="text-[10px] h-5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
									>
										Live Feed
									</Badge>
								</div>
							</div>

							{/* High-Fidelity Client Dashboard Elements */}
							<div className="p-6 md:p-8 bg-gradient-to-br from-background to-muted/20 text-left">
								{/* Top Market Bar */}
								<div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-border/60">
									<div className="space-y-1">
										<p className="text-xs font-medium text-muted-foreground">
											Unified Net Worth
										</p>
										<div className="flex items-baseline gap-3">
											<h3 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">
												₹28,50,000.00
											</h3>
											<span className="inline-flex items-center text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
												<TrendingUp className="w-3 h-3 mr-1" />
												+14.8% XIRR
											</span>
										</div>
									</div>

									{/* Ticker pills */}
									<div className="flex flex-wrap items-center gap-2.5">
										<div className="px-3 py-1.5 rounded-lg bg-card border border-border/80 text-xs">
											<span className="text-muted-foreground font-medium">
												NIFTY 50:{" "}
											</span>
											<span className="font-bold text-foreground">
												24,530.45
											</span>
											<span className="text-emerald-600 dark:text-emerald-400 font-semibold ml-1.5">
												+0.46%
											</span>
										</div>
										<div className="px-3 py-1.5 rounded-lg bg-card border border-border/80 text-xs">
											<span className="text-muted-foreground font-medium">
												SENSEX:{" "}
											</span>
											<span className="font-bold text-foreground">
												80,320.10
											</span>
											<span className="text-emerald-600 dark:text-emerald-400 font-semibold ml-1.5">
												+0.43%
											</span>
										</div>
									</div>
								</div>

								{/* Multi-Asset Allocation Grid */}
								<div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
									{/* Asset Breakdown */}
									<div className="col-span-2 space-y-4">
										<div className="flex items-center justify-between">
											<h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
												<PieChart className="w-4 h-4 text-primary" />
												Multi-Asset Allocation Breakdown
											</h4>
											<span className="text-xs text-muted-foreground">
												4 Asset Classes
											</span>
										</div>

										{/* Allocation Bar */}
										<div className="h-3 w-full rounded-full overflow-hidden flex bg-muted">
											<div
												className="bg-primary h-full"
												style={{ width: "42%" }}
												title="Equities: 42%"
											/>
											<div
												className="bg-emerald-500 h-full"
												style={{ width: "31%" }}
												title="Fixed Income: 31%"
											/>
											<div
												className="bg-purple-500 h-full"
												style={{ width: "17%" }}
												title="Alternatives/Unlisted: 17%"
											/>
											<div
												className="bg-amber-500 h-full"
												style={{ width: "10%" }}
												title="Liquid Cash: 10%"
											/>
										</div>

										<div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
											<div className="p-2.5 rounded-lg bg-card border border-border/60">
												<div className="flex items-center gap-1.5 text-muted-foreground mb-1">
													<div className="w-2 h-2 rounded-full bg-primary" />
													<span>Equities (42%)</span>
												</div>
												<p className="font-bold text-foreground">₹11,97,000</p>
											</div>
											<div className="p-2.5 rounded-lg bg-card border border-border/60">
												<div className="flex items-center gap-1.5 text-muted-foreground mb-1">
													<div className="w-2 h-2 rounded-full bg-emerald-500" />
													<span>Bonds (31%)</span>
												</div>
												<p className="font-bold text-foreground">₹8,83,500</p>
											</div>
											<div className="p-2.5 rounded-lg bg-card border border-border/60">
												<div className="flex items-center gap-1.5 text-muted-foreground mb-1">
													<div className="w-2 h-2 rounded-full bg-purple-500" />
													<span>Unlisted (17%)</span>
												</div>
												<p className="font-bold text-foreground">₹4,84,500</p>
											</div>
											<div className="p-2.5 rounded-lg bg-card border border-border/60">
												<div className="flex items-center gap-1.5 text-muted-foreground mb-1">
													<div className="w-2 h-2 rounded-full bg-amber-500" />
													<span>Liquid (10%)</span>
												</div>
												<p className="font-bold text-foreground">₹2,85,000</p>
											</div>
										</div>
									</div>

									{/* Smart Advisory Health Card */}
									<div className="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-3">
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-1.5">
												<Sparkles className="w-4 h-4 text-primary" />
												<span className="text-xs font-bold text-primary">
													FASP-AI INSIGHT
												</span>
											</div>
											<Badge
												variant="secondary"
												className="text-[10px] bg-primary/10 text-primary border-primary/20"
											>
												Healthy
											</Badge>
										</div>
										<p className="text-xs text-muted-foreground leading-relaxed">
											Your portfolio has optimal duration match and ₹34,500 in
											harvestable tax-loss harvest opportunities before March 31.
										</p>
										<div className="pt-2 border-t border-primary/15 flex items-center justify-between text-xs">
											<span className="text-muted-foreground">
												Rebalancing Score
											</span>
											<span className="font-bold text-foreground">94 / 100</span>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Products Section */}
			<section id="products" className="py-24 bg-muted/40 border-y border-border/40">
				<div className="container mx-auto px-6">
					<div className="text-center mb-16 max-w-3xl mx-auto">
						<Badge
							variant="outline"
							className="mb-3 px-3 py-1 text-xs font-semibold text-primary border-primary/30"
						>
							COMPREHENSIVE ECOSYSTEM
						</Badge>
						<h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
							Multi-Asset Solutions Under One Roof
						</h2>
						<p className="text-lg text-muted-foreground leading-relaxed">
							Diversify effortlessly across regulated asset classes with bank-grade
							security, direct routing, and transparent execution.
						</p>
					</div>

					<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
						{products.map((p, idx) => {
							const IconComponent = p.icon;
							return (
								<button
									type="button"
									key={idx}
									onClick={() => setLocation(p.href)}
									className="group p-6 rounded-2xl bg-card border border-border/60 hover:border-primary/40 shadow-sm hover:shadow-xl transition-all duration-300 cursor-pointer flex flex-col justify-between text-left"
								>
									<div>
										<div className="flex items-center justify-between mb-4">
											<div
												className={cn(
													"w-12 h-12 rounded-xl flex items-center justify-center border group-hover:scale-105 transition-transform",
													p.color,
												)}
											>
												<IconComponent className="w-6 h-6" />
											</div>
											<Badge variant="secondary" className="text-xs font-medium">
												{p.badge}
											</Badge>
										</div>
										<h3 className="text-lg font-bold mb-2 group-hover:text-primary transition-colors">
											{p.title}
										</h3>
										<p className="text-sm text-muted-foreground leading-relaxed">
											{p.description}
										</p>
									</div>

									<div className="mt-6 pt-4 border-t border-border/50 flex items-center justify-between text-xs font-medium text-primary">
										<span>Explore Offerings</span>
										<ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
									</div>
								</button>
							);
						})}
					</div>
				</div>
			</section>

			{/* FASP-AI Decision Support Framework Section */}
			<section
				id="ai-decision-support"
				className="py-24 relative overflow-hidden bg-background"
			>
				<div className="container mx-auto px-6">
					<div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
						<div className="space-y-6">
							<Badge
								variant="outline"
								className="px-3 py-1 text-xs font-semibold text-amber-500 border-amber-500/30 bg-amber-500/10"
							>
								FASP-AI v1.0 • SEBI RIA COMPLIANT
							</Badge>
							<h2 className="text-3xl md:text-5xl font-bold tracking-tight leading-tight">
								Quantitative Intelligence with Absolute Explainability.
							</h2>
							<p className="text-muted-foreground text-lg leading-relaxed">
								Unlike black-box algorithms, FintekPro's advisory engine adheres
								strictly to deterministic financial math. Every metric exposes its
								underlying formula, data inputs, and confidence score.
							</p>

							<div className="space-y-4 pt-2">
								<div className="flex items-start gap-3">
									<CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
									<div>
										<h4 className="font-semibold text-foreground">
											Decision Support Only
										</h4>
										<p className="text-sm text-muted-foreground">
											AI assists your decisions but never executes trades
											autonomously. Final action always rests in your control.
										</p>
									</div>
								</div>
								<div className="flex items-start gap-3">
									<CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
									<div>
										<h4 className="font-semibold text-foreground">
											Multi-Factor Risk Attribution
										</h4>
										<p className="text-sm text-muted-foreground">
											Continuous tracking of Sharpe, Sortino, Alpha, Beta, and
											Maximum Drawdown across your full holdings.
										</p>
									</div>
								</div>
								<div className="flex items-start gap-3">
									<CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
									<div>
										<h4 className="font-semibold text-foreground">
											Automated Tax-Loss Harvesting
										</h4>
										<p className="text-sm text-muted-foreground">
											Identify short-term and long-term capital loss offset
											opportunities to minimize your annual tax liability.
										</p>
									</div>
								</div>
							</div>
						</div>

						{/* Interactive Metric Showcase Box */}
						<div className="p-8 rounded-3xl bg-card border border-border/70 shadow-xl space-y-6">
							<div className="flex items-center justify-between pb-4 border-b border-border">
								<span className="font-bold text-base flex items-center gap-2">
									<Activity className="w-4 h-4 text-primary" />
									Engine Verification Metrics
								</span>
								<Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-0 text-xs">
									100% Deterministic
								</Badge>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div className="p-4 rounded-xl bg-muted/30 border border-border/50">
									<p className="text-xs text-muted-foreground">Sharpe Ratio</p>
									<p className="text-xl font-bold text-foreground mt-1">2.14</p>
									<span className="text-[11px] text-emerald-500 font-medium">
										Top 10% Risk Adjusted
									</span>
								</div>
								<div className="p-4 rounded-xl bg-muted/30 border border-border/50">
									<p className="text-xs text-muted-foreground">Max Drawdown</p>
									<p className="text-xl font-bold text-foreground mt-1">-8.4%</p>
									<span className="text-[11px] text-blue-500 font-medium">
										Nifty 50: -14.2%
									</span>
								</div>
								<div className="p-4 rounded-xl bg-muted/30 border border-border/50">
									<p className="text-xs text-muted-foreground">Beta vs Nifty</p>
									<p className="text-xl font-bold text-foreground mt-1">0.78</p>
									<span className="text-[11px] text-muted-foreground">
										Low Systematic Volatility
									</span>
								</div>
								<div className="p-4 rounded-xl bg-muted/30 border border-border/50">
									<p className="text-xs text-muted-foreground">YTM (Debt Basket)</p>
									<p className="text-xl font-bold text-foreground mt-1">7.42%</p>
									<span className="text-[11px] text-emerald-500 font-medium">
										G-Sec + SDL Spread
									</span>
								</div>
							</div>

							<div className="p-4 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between">
								<div className="text-xs">
									<span className="font-semibold text-foreground">
										Engine Version:
									</span>{" "}
									<span className="text-muted-foreground">v1.0 (GCR Certified)</span>
								</div>
								<Button
									onClick={() => setLocation("/auth")}
									size="sm"
									className="rounded-full text-xs"
								>
									Run Diagnostics
								</Button>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Multi-Domain Ecosystem Section */}
			<section id="ecosystem" className="py-24 bg-gradient-to-b from-background via-muted/20 to-background border-t border-border/40">
				<div className="container mx-auto px-6">
					<div className="text-center mb-16 max-w-3xl mx-auto">
						<Badge
							variant="outline"
							className="mb-3 px-3 py-1 text-xs font-semibold text-primary border-primary/30"
						>
							MULTI-DOMAIN WEALTH PLATFORM
						</Badge>
						<h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
							Three Specialized Portals. One Financial Ecosystem.
						</h2>
						<p className="text-lg text-muted-foreground">
							Whether you are an individual wealth builder, an AMFI/SEBI certified financial advisor, or a chartered accountant, FintekPro provides purpose-built domains engineered for your practice.
						</p>
					</div>

					<div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
						{/* 1. Client & Family Office Portal */}
						<div className="p-8 rounded-2xl bg-card border border-border/70 hover:border-blue-500/50 hover:shadow-xl transition-all duration-300 flex flex-col justify-between relative group">
							<div className="space-y-4">
								<div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
									<Shield className="w-6 h-6" />
								</div>
								<div>
									<Badge variant="secondary" className="text-[10px] font-mono mb-2">fintekpro.com</Badge>
									<h3 className="text-xl font-bold text-foreground">For Investors & Families</h3>
									<p className="text-sm text-muted-foreground mt-2 leading-relaxed">
										Direct Mutual Funds with 0% commission, institutional Sovereign Gold Bonds, G-Sec debt, Mainboard IPO bidding, and AI portfolio management.
									</p>
								</div>
								<ul className="space-y-2 text-xs text-muted-foreground pt-2">
									<li className="flex items-center gap-2">
										<CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
										14,000+ Direct Mutual Fund schemes
									</li>
									<li className="flex items-center gap-2">
										<CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
										Bonds & NCDs with transparent YTM
									</li>
									<li className="flex items-center gap-2">
										<CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
										Multi-expiry derivative hedging analyzer
									</li>
								</ul>
							</div>
							<div className="pt-6 mt-6 border-t border-border/50">
								<Button
									className="w-full text-xs rounded-full h-9"
									onClick={() => setLocation("/auth?mode=register")}
								>
									Start as Investor <ArrowRight className="w-3.5 h-3.5 ml-1" />
								</Button>
							</div>
						</div>

						{/* 2. Partner & Advisor Portal */}
						<div className="p-8 rounded-2xl bg-card border-2 border-purple-500/30 hover:border-purple-500 hover:shadow-xl transition-all duration-300 flex flex-col justify-between relative group bg-gradient-to-b from-purple-500/[0.03] to-transparent">
							<div className="absolute -top-3 right-6">
								<Badge className="bg-purple-600 text-white text-[10px] font-semibold px-2 py-0.5">
									For MFDs & RIAs
								</Badge>
							</div>
							<div className="space-y-4">
								<div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-600">
									<Briefcase className="w-6 h-6" />
								</div>
								<div>
									<Badge variant="secondary" className="text-[10px] font-mono mb-2">partner.fintekpro.com</Badge>
									<h3 className="text-xl font-bold text-foreground">For Financial Advisors</h3>
									<p className="text-sm text-muted-foreground mt-2 leading-relaxed">
										Professional workspace for Mutual Fund Distributors, SEBI Registered Investment Advisors, and wealth managers with instant client proposal dispatch and CRM.
									</p>
								</div>
								<ul className="space-y-2 text-xs text-muted-foreground pt-2">
									<li className="flex items-center gap-2">
										<CheckCircle2 className="w-4 h-4 text-purple-500 shrink-0" />
										Multi-AMC automated proposal generator
									</li>
									<li className="flex items-center gap-2">
										<CheckCircle2 className="w-4 h-4 text-purple-500 shrink-0" />
										1-Click Trade Dispatch to client app
									</li>
									<li className="flex items-center gap-2">
										<CheckCircle2 className="w-4 h-4 text-purple-500 shrink-0" />
										Real-time revenue & payout ledger
									</li>
								</ul>
							</div>
							<div className="pt-6 mt-6 border-t border-border/50">
								<Button
									className="w-full text-xs rounded-full h-9 bg-purple-600 hover:bg-purple-700 text-white"
									onClick={() => setLocation("/partner/register")}
								>
									Partner Registration <ArrowRight className="w-3.5 h-3.5 ml-1" />
								</Button>
							</div>
						</div>

						{/* 3. Chartered Accountant Practice Portal */}
						<div className="p-8 rounded-2xl bg-card border border-border/70 hover:border-sky-500/50 hover:shadow-xl transition-all duration-300 flex flex-col justify-between relative group">
							<div className="space-y-4">
								<div className="w-12 h-12 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-600">
									<GraduationCap className="w-6 h-6" />
								</div>
								<div>
									<Badge variant="secondary" className="text-[10px] font-mono mb-2">ca.fintekpro.com</Badge>
									<h3 className="text-xl font-bold text-foreground">For Chartered Accountants</h3>
									<p className="text-sm text-muted-foreground mt-2 leading-relaxed">
										Comprehensive tax compliance engine for CA firms with automated multi-broker capital gains computation, AIS/26AS reconciliation, and client tax vaults.
									</p>
								</div>
								<ul className="space-y-2 text-xs text-muted-foreground pt-2">
									<li className="flex items-center gap-2">
										<CheckCircle2 className="w-4 h-4 text-sky-500 shrink-0" />
										Sec 112A Grandfathering capital gains
									</li>
									<li className="flex items-center gap-2">
										<CheckCircle2 className="w-4 h-4 text-sky-500 shrink-0" />
										Form 16 / 26AS / AIS automated parser
									</li>
									<li className="flex items-center gap-2">
										<CheckCircle2 className="w-4 h-4 text-sky-500 shrink-0" />
										ITR-1 through ITR-6 client filings
									</li>
								</ul>
							</div>
							<div className="pt-6 mt-6 border-t border-border/50">
								<Button
									variant="outline"
									className="w-full text-xs rounded-full h-9 border-sky-500/30 hover:bg-sky-500/10 text-sky-600 dark:text-sky-400"
									onClick={() => setLocation("/ca-registration")}
								>
									CA Firm Onboarding <ArrowRight className="w-3.5 h-3.5 ml-1" />
								</Button>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Native Mobile Apps Showcase Section */}
			<section id="mobile-apps" className="py-24 bg-gradient-to-b from-muted/30 via-background to-muted/20 border-t border-border/40 relative overflow-hidden">
				<div className="container mx-auto px-6 relative z-10">
					<div className="text-center mb-16 max-w-3xl mx-auto">
						<div className="inline-flex items-center gap-2 mb-3">
							<Badge
								variant="outline"
								className="px-3 py-1 text-xs font-semibold text-primary border-primary/30"
							>
								NATIVE MOBILE APPS
							</Badge>
							<Badge
								variant="secondary"
								className="px-2.5 py-0.5 text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
							>
								iOS & Android Live
							</Badge>
						</div>
						<h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
							Institutional Wealth Cockpit in Your Pocket
						</h2>
						<p className="text-lg text-muted-foreground">
							Native apps powered by Expo New Architecture with sub-second biometric unlock,
							live trade dispatch, zero-leak screen shielding, and instant UPI autopay.
						</p>
					</div>

					<div className="grid lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
						{/* 1. FintekPro Investor App */}
						<div className="p-8 md:p-10 rounded-3xl bg-card border border-border/70 hover:border-primary/50 hover:shadow-2xl transition-all duration-300 flex flex-col justify-between relative group overflow-hidden">
							<div className="absolute top-0 right-0 w-36 h-36 bg-primary/10 rounded-bl-full pointer-events-none group-hover:bg-primary/20 transition-colors" />
							<div>
								<div className="flex items-center justify-between mb-6">
									<div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-inner">
										<Smartphone className="w-7 h-7" />
									</div>
									<div className="text-right">
										<Badge variant="outline" className="text-[11px] font-mono text-primary border-primary/30">
											com.fintekpro.investor
										</Badge>
										<span className="block text-[11px] text-muted-foreground mt-0.5">Expo SDK 52 Native</span>
									</div>
								</div>

								<h3 className="text-2xl font-bold text-foreground">FintekPro Investor App</h3>
								<p className="text-xs uppercase font-semibold text-primary tracking-wider mt-1 mb-4">
									For Retail Investors, HNIs & Wealth Creators
								</p>
								<p className="text-sm text-muted-foreground leading-relaxed mb-6">
									Execute mutual fund SIPs, debt securities, unlisted shares, and IPO biddings with seamless biometrics and bank-grade depository synchronization.
								</p>

								<div className="grid sm:grid-cols-2 gap-3.5 mb-8">
									<div className="p-3.5 rounded-xl bg-muted/40 border border-border/40 flex items-start gap-3">
										<Fingerprint className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
										<div>
											<h4 className="text-xs font-semibold text-foreground">Face ID & Fingerprint</h4>
											<p className="text-[11px] text-muted-foreground">Hardware enclave biometric sign-in</p>
										</div>
									</div>
									<div className="p-3.5 rounded-xl bg-muted/40 border border-border/40 flex items-start gap-3">
										<Coins className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
										<div>
											<h4 className="text-xs font-semibold text-foreground">1-Tap UPI Autopay</h4>
											<p className="text-[11px] text-muted-foreground">Instant recurring mandates for SIPs</p>
										</div>
									</div>
									<div className="p-3.5 rounded-xl bg-muted/40 border border-border/40 flex items-start gap-3">
										<EyeOff className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
										<div>
											<h4 className="text-xs font-semibold text-foreground">Screen Shield</h4>
											<p className="text-[11px] text-muted-foreground">Prevents unauthorized screen capture</p>
										</div>
									</div>
									<div className="p-3.5 rounded-xl bg-muted/40 border border-border/40 flex items-start gap-3">
										<Bell className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
										<div>
											<h4 className="text-xs font-semibold text-foreground">Real-Time FCM Push</h4>
											<p className="text-[11px] text-muted-foreground">Live trade confirms & dividend alerts</p>
										</div>
									</div>
								</div>
							</div>

							<div className="pt-6 border-t border-border/60 flex flex-col sm:flex-row items-center gap-3">
								<Button
									className="w-full sm:w-auto flex-1 h-11 rounded-xl bg-foreground hover:bg-foreground/90 text-background font-semibold text-xs gap-2 shadow-md"
									onClick={() => setLocation("/auth?mode=register")}
								>
									<Apple className="w-4 h-4" /> App Store (iOS)
								</Button>
								<Button
									className="w-full sm:w-auto flex-1 h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs gap-2 shadow-md"
									onClick={() => setLocation("/auth?mode=register")}
								>
									<Download className="w-4 h-4" /> Google Play (Android)
								</Button>
							</div>
						</div>

						{/* 2. FintekPro Partner App */}
						<div className="p-8 md:p-10 rounded-3xl bg-card border border-border/70 hover:border-purple-500/50 hover:shadow-2xl transition-all duration-300 flex flex-col justify-between relative group overflow-hidden">
							<div className="absolute top-0 right-0 w-36 h-36 bg-purple-500/10 rounded-bl-full pointer-events-none group-hover:bg-purple-500/20 transition-colors" />
							<div>
								<div className="flex items-center justify-between mb-6">
									<div className="w-14 h-14 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-600 shadow-inner">
										<Briefcase className="w-7 h-7" />
									</div>
									<div className="text-right">
										<Badge variant="outline" className="text-[11px] font-mono text-purple-600 border-purple-500/30">
											com.fintekpro.agent
										</Badge>
										<span className="block text-[11px] text-muted-foreground mt-0.5">Advisor Edition</span>
									</div>
								</div>

								<h3 className="text-2xl font-bold text-foreground">FintekPro Partner App</h3>
								<p className="text-xs uppercase font-semibold text-purple-600 dark:text-purple-400 tracking-wider mt-1 mb-4">
									For Mutual Fund Distributors, RIAs & Wealth Managers
								</p>
								<p className="text-sm text-muted-foreground leading-relaxed mb-6">
									Manage client relationships, dispatch multi-AMC investment proposals with 1 click, track real-time revenue, and perform on-the-go KYC verification.
								</p>

								<div className="grid sm:grid-cols-2 gap-3.5 mb-8">
									<div className="p-3.5 rounded-xl bg-muted/40 border border-border/40 flex items-start gap-3">
										<Camera className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
										<div>
											<h4 className="text-xs font-semibold text-foreground">Camera KYC Scanner</h4>
											<p className="text-[11px] text-muted-foreground">Instant PAN, Aadhaar & cheque capture</p>
										</div>
									</div>
									<div className="p-3.5 rounded-xl bg-muted/40 border border-border/40 flex items-start gap-3">
										<Send className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
										<div>
											<h4 className="text-xs font-semibold text-foreground">1-Click Trade Dispatch</h4>
											<p className="text-[11px] text-muted-foreground">Proposals push directly to client apps</p>
										</div>
									</div>
									<div className="p-3.5 rounded-xl bg-muted/40 border border-border/40 flex items-start gap-3">
										<TrendingUp className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
										<div>
											<h4 className="text-xs font-semibold text-foreground">Revenue Cockpit</h4>
											<p className="text-[11px] text-muted-foreground">Trail brokerage ledger & AUM tracking</p>
										</div>
									</div>
									<div className="p-3.5 rounded-xl bg-muted/40 border border-border/40 flex items-start gap-3">
										<Lock className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
										<div>
											<h4 className="text-xs font-semibold text-foreground">Secure Client Vault</h4>
											<p className="text-[11px] text-muted-foreground">Encrypted offline cache with biometric lock</p>
										</div>
									</div>
								</div>
							</div>

							<div className="pt-6 border-t border-border/60 flex flex-col sm:flex-row items-center gap-3">
								<Button
									className="w-full sm:w-auto flex-1 h-11 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-semibold text-xs gap-2 shadow-md"
									onClick={() => setLocation("/partner/register")}
								>
									<Briefcase className="w-4 h-4" /> Partner Registration
								</Button>
								<Button
									variant="outline"
									className="w-full sm:w-auto flex-1 h-11 rounded-xl border-purple-500/30 hover:bg-purple-500/10 text-purple-600 dark:text-purple-400 font-semibold text-xs gap-2"
									onClick={() => window.open("https://partner.fintekpro.com", "_blank")}
								>
									<ExternalLink className="w-4 h-4" /> Launch Partner Web
								</Button>
							</div>
						</div>
					</div>

					{/* Mobile Technology Advantage Footer Bar */}
					<div className="mt-12 p-6 rounded-2xl bg-card border border-border/60 max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground">
						<div className="flex items-center gap-2">
							<CheckCircle2 className="w-4 h-4 text-emerald-500" />
							<span><strong>Bi-Directional Sync:</strong> Portfolios sync seamlessly across web, iOS & Android</span>
						</div>
						<div className="flex items-center gap-2">
							<CheckCircle2 className="w-4 h-4 text-emerald-500" />
							<span><strong>FASP-AI Integration:</strong> Real-time risk alerts and algorithmic market scans</span>
						</div>
						<div className="flex items-center gap-2">
							<CheckCircle2 className="w-4 h-4 text-emerald-500" />
							<span><strong>Zero-Knowledge Vault:</strong> Credentials stored in hardware SecureStore</span>
						</div>
					</div>
				</div>
			</section>

			{/* Institutional Trust & About Us Section */}
			<section id="about" className="py-24 bg-muted/30 border-t border-border/40">
				<div className="container mx-auto px-6">
					<div className="text-center mb-16 max-w-3xl mx-auto">
						<Badge
							variant="outline"
							className="mb-3 px-3 py-1 text-xs font-semibold text-primary border-primary/30"
						>
							ABOUT FINTEKPRO
						</Badge>
						<h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
							Institutional Trust & Infrastructure
						</h2>
						<p className="text-lg text-muted-foreground">
							FINTEKPRO FINANCIAL SERVICES LLP powers modern wealth creation
							with bank-grade depository integrations and rigorous regulatory alignment.
						</p>
					</div>

					<div className="grid md:grid-cols-4 gap-6 max-w-6xl mx-auto">
						<div className="p-6 rounded-2xl bg-card border border-border/60 text-center space-y-3">
							<div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center mx-auto text-blue-500">
								<Shield className="w-6 h-6" />
							</div>
							<h4 className="font-bold text-foreground">Depository Links</h4>
							<p className="text-xs text-muted-foreground">
								Direct integration with NSDL and CDSL depositories for seamless
								demat holding reconciliation.
							</p>
						</div>

						<div className="p-6 rounded-2xl bg-card border border-border/60 text-center space-y-3">
							<div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mx-auto text-emerald-500">
								<Lock className="w-6 h-6" />
							</div>
							<h4 className="font-bold text-foreground">Bank-Grade Security</h4>
							<p className="text-xs text-muted-foreground">
								256-bit encryption, ISO 27001 audited data centers, and
								mandatory multi-factor authentication.
							</p>
						</div>

						<div className="p-6 rounded-2xl bg-card border border-border/60 text-center space-y-3">
							<div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center mx-auto text-purple-500">
								<BarChart3 className="w-6 h-6" />
							</div>
							<h4 className="font-bold text-foreground">SEBI RIA Aligned</h4>
							<p className="text-xs text-muted-foreground">
								Decision support architecture built under SEBI investment advisor
								and portfolio disclosure norms.
							</p>
						</div>

						<div className="p-6 rounded-2xl bg-card border border-border/60 text-center space-y-3">
							<div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center mx-auto text-amber-500">
								<Globe className="w-6 h-6" />
							</div>
							<h4 className="font-bold text-foreground">Licensed Market Feeds</h4>
							<p className="text-xs text-muted-foreground">
								Authoritative real-time quote feeds directly from NSE, BSE,
								and Upstox licensed connectivity.
							</p>
						</div>
					</div>
				</div>
			</section>

			{/* CTA Section */}
			<section className="py-24 relative overflow-hidden bg-background">
				<div className="absolute inset-0 bg-primary/5" />
				<div className="container mx-auto px-6 relative z-10 text-center">
					<h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">
						Ready to Experience Smarter Wealth Management?
					</h2>
					<p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
						Join investors and certified advisors who trust FintekPro Financial
						Services LLP for institutional-grade portfolio oversight.
					</p>
					<Button
						onClick={() => setLocation("/auth?mode=register")}
						size="lg"
						className="text-base h-13 px-10 rounded-full shadow-2xl shadow-primary/30 hover:scale-105 transition-all"
					>
						Create Free Account <ArrowRight className="w-4 h-4 ml-2" />
					</Button>

					<div className="mt-12 flex flex-wrap items-center justify-center gap-6 sm:gap-8 text-muted-foreground text-xs sm:text-sm font-medium">
						<span className="flex items-center gap-1.5">
							<CheckCircle className="w-4 h-4 text-emerald-500" /> Bank-grade 256-bit
							Security
						</span>
						<span className="flex items-center gap-1.5">
							<CheckCircle className="w-4 h-4 text-emerald-500" /> SEBI Norms Compliant
						</span>
						<span className="flex items-center gap-1.5">
							<CheckCircle className="w-4 h-4 text-emerald-500" /> 0% Commission Direct MFs
						</span>
					</div>
				</div>
			</section>

			{/* Regulatory Disclaimer Banner */}
			<div className="py-6 bg-muted/60 border-t border-border/40 text-[11px] text-muted-foreground leading-relaxed">
				<div className="container mx-auto px-6 max-w-5xl text-center space-y-2">
					<p className="font-semibold text-foreground/80">
						Regulatory Notice & Market Risk Disclosure:
					</p>
					<p>
						Mutual fund investments and securities trading are subject to market
						risks. Read all scheme and offer documents carefully before investing.
						Past performance is no guarantee of future returns. FintekPro AI
						functions solely as a Decision Support System; final investment
						decisions remain under client confirmation.
					</p>
				</div>
			</div>

			{/* Footer */}
			<footer className="py-12 border-t border-border/50 bg-card">
				<div className="container mx-auto px-6">
					<div className="grid md:grid-cols-5 gap-8 mb-8">
						<div className="md:col-span-2 space-y-3">
							<div className="flex items-center gap-2">
								<Shield className="w-6 h-6 text-primary" />
								<span className="font-bold text-xl tracking-tight">
									FintekPro
								</span>
							</div>
							<p className="text-sm text-muted-foreground max-w-sm">
								FINTEKPRO FINANCIAL SERVICES LLP. Empowering the next generation
								of investors, certified advisors, and tax professionals with institutional-grade technology, transparent
								pricing, and SEBI-aligned decision intelligence.
							</p>
							<div className="pt-2 text-xs text-muted-foreground">
								Registered Office: Mumbai, Maharashtra, India • SEBI Registered Investment Advisory Aligned
							</div>
						</div>
						<div>
							<h4 className="font-semibold mb-4 text-sm text-foreground">
								Products & Tools
							</h4>
							<ul className="space-y-2 text-sm text-muted-foreground">
								<li>
									<a href="/mutual-funds" className="hover:text-primary transition-colors">
										Mutual Funds (0% Comm)
									</a>
								</li>
								<li>
									<a href="/bonds" className="hover:text-primary transition-colors">
										Bonds & Sovereign Debt
									</a>
								</li>
								<li>
									<a href="/unlisted" className="hover:text-primary transition-colors">
										Unlisted Pre-IPO
									</a>
								</li>
								<li>
									<a href="/ipo" className="hover:text-primary transition-colors">
										Public IPO Center
									</a>
								</li>
								<li>
									<a href="/tools/portfolio-xray" className="hover:text-primary transition-colors flex items-center gap-1 font-medium text-foreground">
										<Sparkles className="w-3.5 h-3.5 text-primary" /> Free Portfolio X-Ray
									</a>
								</li>
								<li>
									<a href="/calculators" className="hover:text-primary transition-colors">
										25+ Financial Calculators
									</a>
								</li>
								<li>
									<a href="/pricing" className="hover:text-primary transition-colors">
										Pricing Plans
									</a>
								</li>
							</ul>
						</div>
						<div>
							<h4 className="font-semibold mb-4 text-sm text-foreground">
								Ecosystem Portals
							</h4>
							<ul className="space-y-2 text-sm text-muted-foreground">
								<li>
									<a href="https://partner.fintekpro.com" className="hover:text-purple-600 dark:hover:text-purple-400 transition-colors flex items-center gap-1">
										Partner Portal <ExternalLink className="w-3 h-3 opacity-60" />
									</a>
								</li>
								<li>
									<a href="/partner/register" className="hover:text-purple-600 dark:hover:text-purple-400 transition-colors">
										Partner Registration (MFD/RIA)
									</a>
								</li>
								<li>
									<a href="https://ca.fintekpro.com" className="hover:text-sky-600 dark:hover:text-sky-400 transition-colors flex items-center gap-1">
										CA Practice Portal <ExternalLink className="w-3 h-3 opacity-60" />
									</a>
								</li>
								<li>
									<a href="/ca-registration" className="hover:text-sky-600 dark:hover:text-sky-400 transition-colors">
										CA Practice Onboarding
									</a>
								</li>
								<li>
									<a href="https://fintekpro.com" className="hover:text-primary transition-colors">
										Client Wealth Dashboard
									</a>
								</li>
								<li>
									<a href="#mobile-apps" className="hover:text-primary transition-colors flex items-center gap-1.5">
										<Smartphone className="w-3.5 h-3.5 text-primary opacity-80" /> FintekPro Mobile (iOS & Android)
									</a>
								</li>
							</ul>
						</div>
						<div>
							<h4 className="font-semibold mb-4 text-sm text-foreground">
								Legal & Support
							</h4>
							<ul className="space-y-2 text-sm text-muted-foreground">
								<li>
									<a href="/privacy" className="hover:text-primary transition-colors">
										Privacy Policy
									</a>
								</li>
								<li>
									<a href="/terms" className="hover:text-primary transition-colors">
										Terms of Service
									</a>
								</li>
								<li>
									<a href="/disclaimer" className="hover:text-primary transition-colors">
										Investment Disclaimer
									</a>
								</li>
								<li>
									<a href="/refund-policy" className="hover:text-primary transition-colors">
										Refund Policy
									</a>
								</li>
								<li className="pt-2 text-xs">support@fintekpro.com</li>
							</ul>
						</div>
					</div>
					<div className="pt-8 border-t border-border/50 text-center text-xs text-muted-foreground">
						© {new Date().getFullYear()} FINTEKPRO FINANCIAL SERVICES LLP. All
						rights reserved.
					</div>
				</div>
			</footer>
		</div>
	);
}
