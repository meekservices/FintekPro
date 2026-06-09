import { useAuth } from "@/hooks/useAuth";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
	ArrowRight,
	Shield,
	TrendingUp,
	BarChart3,
	Globe,
	Zap,
	CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function LandingPage() {
	const { isAuthenticated, isLoading, user } = useAuth();
	const [, setLocation] = useLocation();
	const [isScrolled, setIsScrolled] = useState(false);

	useEffect(() => {
		const handleScroll = () => {
			setIsScrolled(window.scrollY > 50);
		};
		window.addEventListener("scroll", handleScroll);
		return () => window.removeEventListener("scroll", handleScroll);
	}, []);

	useEffect(() => {
		if (!isLoading && isAuthenticated && user) {
			// Safely access data if it exists without type assertions
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
				setLocation("/dashboard"); // Standard Retail User dashboard
			}
		}
	}, [isAuthenticated, isLoading, user, setLocation]);

	// Don't show landing page flash if authenticated
	if (isLoading || isAuthenticated) return null;

	return (
		<div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/30">
			<style>{`
        .asset-allocation-donut {
          background: conic-gradient(hsl(var(--primary)) 0% 42%, #10b981 42% 73%, #a855f7 73% 90%, #f59e0b 90% 100%);
        }
      `}</style>
			{/* Navigation */}
			<nav
				className={cn(
					"fixed top-0 w-full z-50 transition-all duration-300 border-b border-transparent",
					isScrolled
						? "bg-background/80 backdrop-blur-md border-border shadow-sm py-3"
						: "bg-transparent py-5",
				)}
			>
				<div className="container mx-auto px-6 flex items-center justify-between">
					<div
						className="flex items-center gap-2 group cursor-pointer"
						onClick={() => setLocation("/")}
					>
						<div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
							<Shield className="w-6 h-6 text-primary group-hover:scale-110 transition-transform duration-300" />
						</div>
						<span className="font-bold text-2xl tracking-tight bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
							FintekPro
						</span>
					</div>
					<div className="hidden md:flex items-center gap-8">
						<a
							href="#features"
							className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
						>
							Features
						</a>
						<a
							href="#about"
							className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
						>
							About Us
						</a>
						<Button
							onClick={() => setLocation("/auth")}
							variant="ghost"
							className="text-sm font-medium"
						>
							Log In
						</Button>
						<Button
							onClick={() => setLocation("/auth")}
							className="text-sm font-medium shadow-lg shadow-primary/20 rounded-full px-6"
						>
							Get Started <ArrowRight className="w-4 h-4 ml-2" />
						</Button>
					</div>
				</div>
			</nav>

			{/* Hero Section */}
			<section className="relative pt-32 pb-20 md:pt-48 md:pb-32 overflow-hidden">
				{/* Background Gradients */}
				<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-primary/20 rounded-full blur-[120px] opacity-50 pointer-events-none" />
				<div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[100px] opacity-30 pointer-events-none" />

				<div className="container mx-auto px-6 relative z-10 text-center">
					<div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary font-medium text-sm mb-8 animate-fade-in-up">
						<Zap className="w-4 h-4" /> The Future of Financial Services
					</div>

					<h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-8 leading-[1.1] max-w-4xl mx-auto bg-gradient-to-br from-foreground via-foreground/90 to-foreground/60 bg-clip-text text-transparent">
						Intelligent Wealth Management for the Modern Era.
					</h1>

					<p className="text-xl md:text-2xl text-muted-foreground mb-12 max-w-2xl mx-auto font-light leading-relaxed">
						Unify your portfolio, access exclusive pre-IPOs, and leverage
						AI-driven insights to compound your wealth faster.
					</p>

					<div className="flex flex-col sm:flex-row items-center justify-center gap-4">
						<Button
							onClick={() => setLocation("/auth")}
							size="lg"
							className="w-full sm:w-auto text-lg h-14 px-8 rounded-full shadow-xl shadow-primary/25 hover:scale-105 transition-all duration-300"
						>
							Start Investing Now <ArrowRight className="w-5 h-5 ml-2" />
						</Button>
						<Button
							onClick={() => setLocation("/auth")}
							variant="outline"
							size="lg"
							className="w-full sm:w-auto text-lg h-14 px-8 rounded-full border-2 hover:bg-muted/50 transition-all duration-300"
						>
							View Demo
						</Button>
					</div>

					{/* Dashboard Preview Mockup */}
					<div className="mt-20 relative mx-auto max-w-5xl perspective-[2000px]">
						<div className="relative rounded-2xl md:rounded-[32px] overflow-hidden border border-border/50 shadow-2xl bg-card/40 backdrop-blur-xl transform rotate-x-[15deg] rotate-y-[-5deg] scale-95 hover:rotate-0 hover:scale-100 transition-all duration-700 ease-out">
							<div className="h-12 border-b border-border/50 flex items-center px-4 gap-2 bg-muted/30">
								<div className="w-3 h-3 rounded-full bg-red-500/80" />
								<div className="w-3 h-3 rounded-full bg-yellow-500/80" />
								<div className="w-3 h-3 rounded-full bg-green-500/80" />
							</div>
							<div className="aspect-[16/9] bg-gradient-to-br from-muted/20 to-muted/5 p-8 flex items-center justify-center">
								{/* Mock UI Elements */}
								<div className="w-full h-full grid grid-cols-3 gap-6 opacity-60">
									<div className="col-span-2 space-y-6">
										<div className="h-32 rounded-xl bg-primary/10 border border-primary/20" />
										<div className="h-64 rounded-xl bg-muted/40 border border-border/50" />
									</div>
									<div className="space-y-6">
										<div className="h-48 rounded-xl bg-muted/40 border border-border/50" />
										<div className="h-48 rounded-xl bg-muted/40 border border-border/50" />
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>
			</section>

			{/* Features Section */}
			<section id="features" className="py-24 bg-muted/30">
				<div className="container mx-auto px-6">
					<div className="text-center mb-16">
						<h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-4">
							Everything You Need to Grow
						</h2>
						<p className="text-lg text-muted-foreground max-w-2xl mx-auto">
							From automated mutual fund investments to exclusive private equity
							access, FintekPro provides institutional-grade tools.
						</p>
					</div>

					<div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
						<div className="group p-8 rounded-3xl bg-card border border-border/50 hover:border-primary/30 shadow-sm hover:shadow-xl transition-all duration-300">
							<div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
								<TrendingUp className="w-7 h-7 text-blue-500" />
							</div>
							<h3 className="text-xl font-semibold mb-3">
								AI Portfolio Management
							</h3>
							<p className="text-muted-foreground leading-relaxed">
								Our proprietary algorithms monitor your investments 24/7,
								suggesting rebalancing opportunities and tax-loss harvesting
								automatically.
							</p>
						</div>

						<div className="group p-8 rounded-3xl bg-card border border-border/50 hover:border-emerald-500/30 shadow-sm hover:shadow-xl transition-all duration-300">
							<div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
								<Globe className="w-7 h-7 text-emerald-500" />
							</div>
							<h3 className="text-xl font-semibold mb-3">
								Global Markets Access
							</h3>
							<p className="text-muted-foreground leading-relaxed">
								Invest directly in US equities, unlisted domestic stocks, and
								high-yield bonds from a single unified interface.
							</p>
						</div>

						<div className="group p-8 rounded-3xl bg-card border border-border/50 hover:border-purple-500/30 shadow-sm hover:shadow-xl transition-all duration-300">
							<div className="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
								<BarChart3 className="w-7 h-7 text-purple-500" />
							</div>
							<h3 className="text-xl font-semibold mb-3">
								Institutional Reporting
							</h3>
							<p className="text-muted-foreground leading-relaxed">
								Generate CA-ready capital gains reports, comprehensive XIRR
								analysis, and holistic net-worth statements instantly.
							</p>
						</div>
					</div>
				</div>
			</section>

			{/* CTA Section */}
			<section className="py-24 relative overflow-hidden">
				<div className="absolute inset-0 bg-primary/5" />
				<div className="container mx-auto px-6 relative z-10 text-center">
					<h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-8">
						Ready to Transform Your Finances?
					</h2>
					<p className="text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
						Join thousands of smart investors who trust FintekPro Financial
						Services LLP for their wealth creation journey.
					</p>
					<Button
						onClick={() => setLocation("/auth")}
						size="lg"
						className="text-lg h-14 px-10 rounded-full shadow-2xl shadow-primary/30"
					>
						Create Free Account
					</Button>

					<div className="mt-12 flex items-center justify-center gap-8 text-muted-foreground text-sm font-medium">
						<span className="flex items-center gap-2">
							<CheckCircle className="w-4 h-4 text-primary" /> Bank-grade
							Security
						</span>
						<span className="flex items-center gap-2">
							<CheckCircle className="w-4 h-4 text-primary" /> SEBI Registered
						</span>
						<span className="flex items-center gap-2">
							<CheckCircle className="w-4 h-4 text-primary" /> 24/7 Support
						</span>
					</div>
				</div>
			</section>

			{/* Footer */}
			<footer className="py-12 border-t border-border/50 bg-muted/10">
				<div className="container mx-auto px-6">
					<div className="grid md:grid-cols-4 gap-8 mb-8">
						<div className="col-span-2">
							<div className="flex items-center gap-2 mb-4">
								<Shield className="w-6 h-6 text-primary" />
								<span className="font-bold text-xl tracking-tight">
									FintekPro
								</span>
							</div>
							<p className="text-sm text-muted-foreground max-w-xs">
								FintekPro Financial Services LLP. Empowering the next generation
								of investors with institutional-grade technology.
							</p>
						</div>
						<div>
							<h4 className="font-semibold mb-4">Legal</h4>
							<ul className="space-y-2 text-sm text-muted-foreground">
								<li>
									<a
										href="/privacy"
										className="hover:text-primary transition-colors"
									>
										Privacy Policy
									</a>
								</li>
								<li>
									<a
										href="/terms"
										className="hover:text-primary transition-colors"
									>
										Terms of Service
									</a>
								</li>
								<li>
									<a
										href="/disclaimer"
										className="hover:text-primary transition-colors"
									>
										Investment Disclaimer
									</a>
								</li>
							</ul>
						</div>
						<div>
							<h4 className="font-semibold mb-4">Contact</h4>
							<ul className="space-y-2 text-sm text-muted-foreground">
								<li>support@fintekpro.com</li>
								<li>Mumbai, Maharashtra, India</li>
							</ul>
						</div>
					</div>
					<div className="pt-8 border-t border-border/50 text-center text-sm text-muted-foreground">
						© {new Date().getFullYear()} FintekPro Financial Services LLP. All
						rights reserved.
					</div>
				</div>
			</footer>
		</div>
	);
}
