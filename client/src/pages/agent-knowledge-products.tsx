import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
	FileCheck,
	ChevronLeft,
	Search,
	Filter,
	BookOpen,
	AlertCircle,
	CheckCircle2,
	Tag,
	Sparkles,
	Copy,
	Check,
	Smartphone,
	Mail,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";

interface ProductKnowledge {
	id: string;
	productType: string;
	title: string;
	productCategory?: string;
	productSubCategory?: string;
	description: string;
	keyFeatures: { feature: string; explanation: string }[];
	riskProfile: string;
	timeHorizon?: string;
	suitabilityRules?: { rule: string; applicableTo: string }[];
	contraindications?: { scenario: string; reason: string }[];
	version: number;
	status: string;
	publishedAt?: string;
	tags?: string[];
}

const productTypeOptions = [
	{ value: "all", label: "All Products" },
	{ value: "mutual_fund", label: "Mutual Funds" },
	{ value: "stock", label: "Stocks" },
	{ value: "bond", label: "Bonds & NCDs" },
	{ value: "etf", label: "ETFs" },
	{ value: "aif", label: "AIF" },
	{ value: "pms", label: "PMS" },
	{ value: "insurance", label: "Insurance" },
];

const riskProfileOptions = [
	{ value: "all", label: "All Risk Levels" },
	{ value: "conservative", label: "Conservative" },
	{ value: "moderate", label: "Moderate" },
	{ value: "aggressive", label: "Aggressive" },
	{ value: "very_aggressive", label: "Very Aggressive" },
];

const getRiskBadgeColor = (risk: string) => {
	switch (risk.toLowerCase()) {
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

export default function AgentKnowledgeProducts() {
	const { toast } = useToast();
	const [searchTerm, setSearchTerm] = useState("");
	const [productType, setProductType] = useState("all");
	const [riskProfile, setRiskProfile] = useState("all");
	const [selectedProduct, setSelectedProduct] =
		useState<ProductKnowledge | null>(null);

	// FASP-AI Client Pitch Generator State
	const [pitchPersona, setPitchPersona] = useState<
		"young_wealth_builder" | "conservative_senior" | "hni_tax_optimizer" | "business_owner"
	>("young_wealth_builder");
	const [pitchChannel, setPitchChannel] = useState<"whatsapp" | "email">("whatsapp");
	const [generatedPitch, setGeneratedPitch] = useState<string | null>(null);
	const [isGeneratingPitch, setIsGeneratingPitch] = useState(false);
	const [hasCopiedPitch, setHasCopiedPitch] = useState(false);

	const handleGeneratePitch = async (product: ProductKnowledge) => {
		try {
			setIsGeneratingPitch(true);
			setGeneratedPitch(null);
			setHasCopiedPitch(false);

			const keyFeatures = (product.keyFeatures || []).map((f) =>
				typeof f === "string" ? f : f.feature,
			);

			const res = await fetch("/api/knowledge-hub/generate-pitch", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					productTitle: product.title,
					productType: product.productType,
					persona: pitchPersona,
					channel: pitchChannel,
					keyFeatures,
					riskProfile: product.riskProfile,
				}),
			});

			const data = await res.json();
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

	const { data: products, isLoading } = useQuery<ProductKnowledge[]>({
		queryKey: ["/api/knowledge-hub/products", productType, riskProfile],
		queryFn: async () => {
			const params = new URLSearchParams();
			if (productType !== "all") params.append("productType", productType);
			if (riskProfile !== "all") params.append("riskProfile", riskProfile);
			params.append("status", "published");
			const response = await fetch(`/api/knowledge-hub/products?${params}`);
			if (!response.ok) throw new Error("Failed to fetch products");
			return response.json();
		},
	});

	const filteredProducts = products?.filter(
		(p) =>
			p.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
			p.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
			p.productCategory?.toLowerCase().includes(searchTerm.toLowerCase()),
	);

	return (
		<div className="p-6 space-y-6">
			<div className="flex items-center gap-4">
				<Link href="/agent/knowledge-hub">
					<Button
						variant="ghost"
						size="sm"
						className="text-muted-foreground hover:text-foreground"
					>
						<ChevronLeft className="h-4 w-4 mr-1" />
						Back
					</Button>
				</Link>
				<div>
					<h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
						<FileCheck className="h-7 w-7 text-emerald-500" />
						Product Knowledge Cards
					</h1>
					<p className="text-muted-foreground mt-1">
						Comprehensive product information for client discussions
					</p>
				</div>
			</div>

			<div className="flex flex-col md:flex-row gap-4">
				<div className="relative flex-1">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Search products..."
						value={searchTerm}
						onChange={(e) => setSearchTerm(e.target.value)}
						className="pl-10 bg-background border-border text-foreground"
						data-testid="input-search"
					/>
				</div>
				<Select value={productType} onValueChange={setProductType}>
					<SelectTrigger
						className="w-48 bg-background border-border"
						data-testid="select-product-type"
					>
						<Filter className="h-4 w-4 mr-2" />
						<SelectValue placeholder="Product Type" />
					</SelectTrigger>
					<SelectContent>
						{productTypeOptions.map((opt) => (
							<SelectItem key={opt.value} value={opt.value}>
								{opt.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Select value={riskProfile} onValueChange={setRiskProfile}>
					<SelectTrigger
						className="w-48 bg-background border-border"
						data-testid="select-risk-profile"
					>
						<SelectValue placeholder="Risk Profile" />
					</SelectTrigger>
					<SelectContent>
						{riskProfileOptions.map((opt) => (
							<SelectItem key={opt.value} value={opt.value}>
								{opt.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{isLoading ? (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{[1, 2, 3, 4, 5, 6].map((i) => (
						<Skeleton key={i} className="h-48 bg-card" />
					))}
				</div>
			) : filteredProducts && filteredProducts.length > 0 ? (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{filteredProducts.map((product) => (
						<Card
							key={product.id}
							className="bg-background border-border hover:border-border cursor-pointer transition-colors"
							onClick={() => setSelectedProduct(product)}
							data-testid={`card-product-${product.id}`}
						>
							<CardHeader className="pb-2">
								<div className="flex items-start justify-between">
									<div>
										<CardTitle className="text-foreground text-lg">
											{product.title}
										</CardTitle>
										{product.productCategory && (
											<CardDescription className="text-muted-foreground text-xs">
												{product.productCategory}
											</CardDescription>
										)}
									</div>
									<Badge className={getRiskBadgeColor(product.riskProfile)}>
										{product.riskProfile}
									</Badge>
								</div>
							</CardHeader>
							<CardContent>
								<p className="text-muted-foreground text-sm line-clamp-2 mb-3">
									{product.description}
								</p>
								<div className="flex items-center justify-between">
									<Badge variant="outline" className="text-xs border-border">
										{product.productType.replace(/_/g, " ")}
									</Badge>
									<span className="text-xs text-muted-foreground">
										v{product.version}
									</span>
								</div>
								{product.tags && product.tags.length > 0 && (
									<div className="flex flex-wrap gap-1 mt-2">
										{product.tags.slice(0, 3).map((tag, idx) => (
											<Badge
												key={idx}
												variant="outline"
												className="text-xs border-border text-muted-foreground"
											>
												<Tag className="h-2 w-2 mr-1" />
												{tag}
											</Badge>
										))}
									</div>
								)}
							</CardContent>
						</Card>
					))}
				</div>
			) : (
				<Card className="bg-background border-border">
					<CardContent className="p-8 text-center">
						<BookOpen className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
						<h3 className="text-xl font-semibold text-foreground mb-2">
							No Products Found
						</h3>
						<p className="text-muted-foreground">
							{searchTerm
								? "Try adjusting your search or filters"
								: "Product knowledge cards will appear here once added"}
						</p>
					</CardContent>
				</Card>
			)}

			<Dialog
				open={!!selectedProduct}
				onOpenChange={() => setSelectedProduct(null)}
			>
				<DialogContent className="max-w-3xl max-h-[90vh] bg-background border-border">
					{selectedProduct && (
						<>
							<DialogHeader>
								<div className="flex items-start justify-between">
									<div>
										<DialogTitle className="text-foreground text-xl">
											{selectedProduct.title}
										</DialogTitle>
										<DialogDescription className="text-muted-foreground">
											{selectedProduct.productCategory &&
												`${selectedProduct.productCategory} • `}
											{selectedProduct.productType.replace(/_/g, " ")}
										</DialogDescription>
									</div>
									<Badge
										className={getRiskBadgeColor(selectedProduct.riskProfile)}
									>
										{selectedProduct.riskProfile}
									</Badge>
								</div>
							</DialogHeader>
							<ScrollArea className="max-h-[60vh]">
								<Tabs defaultValue="overview" className="w-full">
									<TabsList className="bg-card mb-4 flex-wrap">
										<TabsTrigger value="overview">Overview</TabsTrigger>
										<TabsTrigger value="suitability">Suitability</TabsTrigger>
										<TabsTrigger value="compliance">Compliance</TabsTrigger>
										<TabsTrigger value="pitch" className="text-emerald-400 flex items-center gap-1.5 font-medium">
											<Sparkles className="h-3.5 w-3.5" />
											Draft Pitch (AI)
										</TabsTrigger>
									</TabsList>

									<TabsContent value="overview" className="space-y-4">
										<div>
											<h4 className="text-sm font-medium text-muted-foreground mb-2">
												Description
											</h4>
											<p className="text-muted-foreground">
												{selectedProduct.description}
											</p>
										</div>

										<div>
											<h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
												<CheckCircle2 className="h-4 w-4 text-emerald-500" />
												Key Features
											</h4>
											<ul className="space-y-1">
												{selectedProduct.keyFeatures?.map((feature, idx) => (
													<li
														key={idx}
														className="text-muted-foreground text-sm flex items-start gap-2"
													>
														<span className="text-emerald-500 mt-1">•</span>
														{typeof feature === "string"
															? feature
															: feature.feature}
													</li>
												))}
											</ul>
										</div>

										{selectedProduct.contraindications &&
											selectedProduct.contraindications.length > 0 && (
												<div>
													<h4 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
														<AlertCircle className="h-4 w-4 text-amber-500" />
														When Not to Recommend
													</h4>
													<ul className="space-y-1">
														{selectedProduct.contraindications.map(
															(item, idx) => (
																<li
																	key={idx}
																	className="text-muted-foreground text-sm flex items-start gap-2"
																>
																	<span className="text-amber-500 mt-1">•</span>
																	{typeof item === "string"
																		? item
																		: item.scenario}
																</li>
															),
														)}
													</ul>
												</div>
											)}

										<div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
											{selectedProduct.timeHorizon && (
												<div>
													<p className="text-xs text-muted-foreground">
														Time Horizon
													</p>
													<p className="text-foreground font-medium">
														{selectedProduct.timeHorizon.replace(/_/g, " ")}
													</p>
												</div>
											)}
											{selectedProduct.riskProfile && (
												<div>
													<p className="text-xs text-muted-foreground">
														Risk Profile
													</p>
													<p className="text-foreground font-medium">
														{selectedProduct.riskProfile}
													</p>
												</div>
											)}
										</div>
									</TabsContent>

									<TabsContent value="suitability" className="space-y-4">
										{selectedProduct.suitabilityRules &&
											selectedProduct.suitabilityRules.length > 0 && (
												<div>
													<h4 className="text-sm font-medium text-emerald-400 mb-2 flex items-center gap-2">
														<CheckCircle2 className="h-4 w-4" />
														Suitability Rules
													</h4>
													<ul className="space-y-2">
														{selectedProduct.suitabilityRules.map(
															(item, idx) => (
																<li
																	key={idx}
																	className="text-muted-foreground text-sm p-2 bg-card/50 rounded"
																>
																	<p className="text-foreground">
																		{typeof item === "string"
																			? item
																			: item.rule}
																	</p>
																	{typeof item !== "string" &&
																		item.applicableTo && (
																			<p className="text-xs text-muted-foreground mt-1">
																				Applicable to: {item.applicableTo}
																			</p>
																		)}
																</li>
															),
														)}
													</ul>
												</div>
											)}

										{selectedProduct.contraindications &&
											selectedProduct.contraindications.length > 0 && (
												<div>
													<h4 className="text-sm font-medium text-red-400 mb-2 flex items-center gap-2">
														<AlertCircle className="h-4 w-4" />
														Contraindications
													</h4>
													<ul className="space-y-2">
														{selectedProduct.contraindications.map(
															(item, idx) => (
																<li
																	key={idx}
																	className="text-muted-foreground text-sm p-2 bg-red-500/10 rounded border border-red-500/20"
																>
																	<p className="text-foreground">
																		{typeof item === "string"
																			? item
																			: item.scenario}
																	</p>
																	{typeof item !== "string" && item.reason && (
																		<p className="text-xs text-red-300/70 mt-1">
																			Reason: {item.reason}
																		</p>
																	)}
																</li>
															),
														)}
													</ul>
												</div>
											)}
									</TabsContent>

									<TabsContent value="compliance" className="space-y-4">
										<div>
											<h4 className="text-sm font-medium text-muted-foreground mb-2">
												Product Details
											</h4>
											<div className="space-y-2">
												<div className="flex items-center justify-between text-sm">
													<span className="text-muted-foreground">
														Product Type
													</span>
													<span className="text-muted-foreground">
														{selectedProduct.productType.replace(/_/g, " ")}
													</span>
												</div>
												{selectedProduct.productCategory && (
													<div className="flex items-center justify-between text-sm">
														<span className="text-muted-foreground">
															Category
														</span>
														<span className="text-muted-foreground">
															{selectedProduct.productCategory}
														</span>
													</div>
												)}
												{selectedProduct.productSubCategory && (
													<div className="flex items-center justify-between text-sm">
														<span className="text-muted-foreground">
															Sub-Category
														</span>
														<span className="text-muted-foreground">
															{selectedProduct.productSubCategory}
														</span>
													</div>
												)}
											</div>
										</div>

										<div className="pt-4 border-t border-border">
											<div className="flex items-center justify-between text-sm">
												<span className="text-muted-foreground">Version</span>
												<span className="text-muted-foreground">
													v{selectedProduct.version}
												</span>
											</div>
											{selectedProduct.publishedAt && (
												<div className="flex items-center justify-between text-sm mt-1">
													<span className="text-muted-foreground">
														Published
													</span>
													<span className="text-muted-foreground">
														{format(
															new Date(selectedProduct.publishedAt),
															"MMM d, yyyy",
														)}
													</span>
												</div>
											)}
										</div>
									</TabsContent>

									<TabsContent value="pitch" className="space-y-4">
										<div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 space-y-1">
											<div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">
												<Sparkles className="h-4 w-4" />
												FASP-AI Client Communication Assistant
											</div>
											<p className="text-xs text-muted-foreground leading-relaxed">
												Generate SEBI-compliant, tailored pitches highlighting suitability, tax impacts under Budget 2024, and mandatory risk disclosures.
											</p>
										</div>

										<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
											<div className="space-y-1.5">
												<div className="text-xs font-medium text-foreground">Target Investor Persona</div>
												<Select
													value={pitchPersona}
													onValueChange={(val: any) => setPitchPersona(val)}
												>
													<SelectTrigger className="text-xs bg-card">
														<SelectValue placeholder="Select Persona" />
													</SelectTrigger>
													<SelectContent>
														<SelectItem value="young_wealth_builder">Young Accumulator (25-38 yrs)</SelectItem>
														<SelectItem value="conservative_senior">Conservative Senior Citizen / Retiree</SelectItem>
														<SelectItem value="hni_tax_optimizer">HNI / Affluent Tax Optimizer</SelectItem>
														<SelectItem value="business_owner">Business Owner / Treasury</SelectItem>
													</SelectContent>
												</Select>
											</div>

											<div className="space-y-1.5">
												<div className="text-xs font-medium text-foreground">Delivery Channel</div>
												<div className="flex gap-2">
													<Button
														type="button"
														size="sm"
														variant={pitchChannel === "whatsapp" ? "default" : "outline"}
														className="text-xs flex-1 h-9 gap-1.5"
														onClick={() => setPitchChannel("whatsapp")}
													>
														<Smartphone className="h-3.5 w-3.5" />
														WhatsApp
													</Button>
													<Button
														type="button"
														size="sm"
														variant={pitchChannel === "email" ? "default" : "outline"}
														className="text-xs flex-1 h-9 gap-1.5"
														onClick={() => setPitchChannel("email")}
													>
														<Mail className="h-3.5 w-3.5" />
														Email
													</Button>
												</div>
											</div>
										</div>

										<Button
											className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
											disabled={isGeneratingPitch}
											onClick={() => handleGeneratePitch(selectedProduct)}
										>
											{isGeneratingPitch ? (
												<>
													<Sparkles className="h-4 w-4 animate-spin" />
													Drafting Compliant Pitch...
												</>
											) : (
												<>
													<Sparkles className="h-4 w-4" />
													Generate {pitchChannel.toUpperCase()} Pitch
												</>
											)}
										</Button>

										{generatedPitch && (
											<div className="p-4 rounded-lg bg-card border border-border space-y-3 mt-3">
												<div className="flex items-center justify-between">
													<Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30">
														FASP-AI v1.0 • SEBI Compliant
													</Badge>
													<Button
														variant="outline"
														size="sm"
														onClick={handleCopyPitch}
														className="h-7 text-xs border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 gap-1.5"
													>
														{hasCopiedPitch ? (
															<>
																<Check className="h-3 w-3" />
																Copied!
															</>
														) : (
															<>
																<Copy className="h-3 w-3" />
																Copy Pitch
															</>
														)}
													</Button>
												</div>
												<div className="text-xs text-foreground/90 whitespace-pre-line leading-relaxed font-sans bg-background/60 p-3 rounded border border-border/50 select-all">
													{generatedPitch}
												</div>
											</div>
										)}
									</TabsContent>
								</Tabs>
							</ScrollArea>
						</>
					)}
				</DialogContent>
			</Dialog>
		</div>
	);
}
