import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs";
import { ScrollableTabsList } from "@/components/ScrollableTabsList";
import {
	Shield as LucideShield,
	Heart,
	Car,
	Home,
	Users,
	TrendingUp,
	Calculator,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { LoadingState } from "@/components/LoadingState";

export default function Insurance() {
	const [selectedType, setSelectedType] = useState<string>("all");

	const { data: insuranceProducts, isLoading } = useQuery({
		queryKey: ["/api/products", "insurance", selectedType],
		queryFn: async () => {
			const params = new URLSearchParams({ category: "insurance" });
			if (selectedType !== "all") params.append("subcategory", selectedType);
			const res = await fetch(`/api/products?${params.toString()}`);
			if (!res.ok) throw new Error("Failed to fetch products");
			return res.json();
		},
		refetchInterval: 120000,
	});

	const insuranceTypes = [
		{
			id: "life",
			name: "Life Insurance",
			icon: Heart,
			description: "Term life, whole life, and endowment plans",
			color: "blue",
			count: 45,
		},
		{
			id: "health",
			name: "Health Insurance",
			icon: LucideShield,
			description: "Medical coverage for individuals and families",
			color: "green",
			count: 67,
		},
		{
			id: "motor",
			name: "Motor Insurance",
			icon: Car,
			description: "Car and two-wheeler comprehensive coverage",
			color: "purple",
			count: 32,
		},
		{
			id: "home",
			name: "Home Insurance",
			icon: Home,
			description: "Property and contents protection",
			color: "orange",
			count: 18,
		},
	];

	return (
		<div className="space-y-8" data-testid="insurance-page">
			<div className="space-y-6">
				<div className="mb-8" data-testid="insurance-header">
					<h1 className="text-3xl font-bold text-foreground mb-4">
						Insurance Hub
					</h1>
					<p className="text-muted-foreground text-lg">
						Comprehensive insurance solutions for life, health, motor, and more
					</p>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
					{insuranceTypes.map((type) => {
						const IconComponent = type.icon;
						return (
							<Card
								key={type.id}
								className="hover:shadow-lg transition-shadow cursor-pointer"
								onClick={() => setSelectedType(type.id)}
								data-testid={`card-${type.id}-insurance`}
							>
								<CardContent className="p-6">
									<div
										className={`w-12 h-12 bg-${type.color}-100 rounded-lg flex items-center justify-center mb-4`}
									>
										<IconComponent
											className={`h-6 w-6 text-finance-${type.color}`}
										/>
									</div>
									<h3 className="font-bold text-foreground mb-2">
										{type.name}
									</h3>
									<p className="text-muted-foreground text-sm mb-4">
										{type.description}
									</p>
									<div className="flex justify-between text-xs">
										<span className="text-muted-foreground">
											Available Plans:
										</span>
										<span className="font-semibold text-finance-blue">
											{type.count}
										</span>
									</div>
								</CardContent>
							</Card>
						);
					})}
				</div>

				<Tabs
					value={selectedType}
					onValueChange={setSelectedType}
					className="w-full"
				>
					<ScrollableTabsList className="grid w-full grid-cols-5">
						<TabsTrigger value="all" data-testid="tab-all">
							All Plans
						</TabsTrigger>
						<TabsTrigger value="life" data-testid="tab-life">
							Life
						</TabsTrigger>
						<TabsTrigger value="health" data-testid="tab-health">
							Health
						</TabsTrigger>
						<TabsTrigger value="motor" data-testid="tab-motor">
							Motor
						</TabsTrigger>
						<TabsTrigger value="home" data-testid="tab-home">
							Home
						</TabsTrigger>
					</ScrollableTabsList>

					<TabsContent value={selectedType} className="space-y-4">
						{isLoading ? (
							<LoadingState variant="card" count={6} />
						) : (
							<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
								{insuranceProducts && insuranceProducts.length > 0 ? (
									insuranceProducts.map((product: any) => (
										<Card
											key={product.id}
											className="hover:shadow-lg transition-shadow"
											data-testid={`insurance-${product.id}`}
										>
											<CardHeader>
												<div className="flex justify-between items-start">
													<div>
														<CardTitle className="text-lg">
															{product.name}
														</CardTitle>
														<p className="text-sm text-muted-foreground mt-1">
															{product.issuer || product.provider}
														</p>
													</div>
													{product.badge && (
														<Badge variant="secondary">{product.badge}</Badge>
													)}
												</div>
											</CardHeader>
											<CardContent className="space-y-4">
												<p className="text-sm text-muted-foreground">
													{product.description}
												</p>

												<div className="space-y-2">
													<div className="flex justify-between text-sm">
														<span className="text-muted-foreground">
															Coverage:
														</span>
														<span className="font-semibold">
															₹
															{product.maxCoverage?.toLocaleString() ||
																"50,00,000"}
														</span>
													</div>
													<div className="flex justify-between text-sm">
														<span className="text-muted-foreground">
															Premium (Annual):
														</span>
														<span className="font-semibold text-finance-green">
															₹
															{product.annualPremium?.toLocaleString() ||
																"12,000"}
														</span>
													</div>
													<div className="flex justify-between text-sm">
														<span className="text-muted-foreground">
															Claim Settlement:
														</span>
														<span className="font-semibold">
															{product.claimSettlementRatio || "95%"}
														</span>
													</div>
													{product.taxBenefit && (
														<div className="flex justify-between text-sm">
															<span className="text-muted-foreground">
																Tax Benefit:
															</span>
															<Badge variant="outline" className="text-xs">
																Section 80C/80D
															</Badge>
														</div>
													)}
												</div>

												<div className="flex gap-2">
													<Button
														className="flex-1"
														size="sm"
														data-testid={`button-buy-${product.id}`}
													>
														Buy Now
													</Button>
													<Button
														variant="outline"
														size="sm"
														data-testid={`button-compare-${product.id}`}
													>
														Compare
													</Button>
												</div>
											</CardContent>
										</Card>
									))
								) : (
									<div className="col-span-full text-center py-12">
										<LucideShield className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
										<p className="text-muted-foreground">
											No insurance plans available in this category.
										</p>
										<p className="text-muted-foreground text-sm mt-2">
											Please check other categories or try again later.
										</p>
									</div>
								)}
							</div>
						)}
					</TabsContent>
				</Tabs>

				<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
					<Card>
						<CardHeader>
							<div className="flex items-center gap-2">
								<Calculator className="h-5 w-5 text-finance-blue" />
								<CardTitle className="text-lg">Premium Calculator</CardTitle>
							</div>
						</CardHeader>
						<CardContent>
							<p className="text-sm text-muted-foreground mb-4">
								Calculate your insurance premium based on age, coverage, and
								policy type
							</p>
							<Button
								className="w-full"
								variant="outline"
								size="sm"
								data-testid="button-calculator"
							>
								Open Calculator
							</Button>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<div className="flex items-center gap-2">
								<TrendingUp className="h-5 w-5 text-finance-green" />
								<CardTitle className="text-lg">Compare Plans</CardTitle>
							</div>
						</CardHeader>
						<CardContent>
							<p className="text-sm text-muted-foreground mb-4">
								Side-by-side comparison of features, premiums, and benefits
							</p>
							<Button
								className="w-full"
								variant="outline"
								size="sm"
								data-testid="button-compare"
							>
								Compare Now
							</Button>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<div className="flex items-center gap-2">
								<Users className="h-5 w-5 text-finance-purple" />
								<CardTitle className="text-lg">Expert Advice</CardTitle>
							</div>
						</CardHeader>
						<CardContent>
							<p className="text-sm text-muted-foreground mb-4">
								Get personalized insurance recommendations from certified
								advisors
							</p>
							<Button
								className="w-full"
								variant="outline"
								size="sm"
								data-testid="button-advisor"
							>
								Talk to Advisor
							</Button>
						</CardContent>
					</Card>
				</div>

				<Card>
					<CardHeader>
						<CardTitle>Why Buy Insurance Through FintekPro?</CardTitle>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div>
								<h3 className="font-semibold mb-2">
									✓ Comprehensive Comparison
								</h3>
								<p className="text-sm text-muted-foreground">
									Compare plans from 20+ leading insurers in one place
								</p>
							</div>
							<div>
								<h3 className="font-semibold mb-2">✓ Best Price Guarantee</h3>
								<p className="text-sm text-muted-foreground">
									Get the same or lower premium than buying directly
								</p>
							</div>
							<div>
								<h3 className="font-semibold mb-2">✓ Claim Assistance</h3>
								<p className="text-sm text-muted-foreground">
									Dedicated support team to help with claim settlement
								</p>
							</div>
							<div>
								<h3 className="font-semibold mb-2">
									✓ Instant Policy Issuance
								</h3>
								<p className="text-sm text-muted-foreground">
									Digital policy delivered within minutes of payment
								</p>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
