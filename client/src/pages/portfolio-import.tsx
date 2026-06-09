import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
	FileSpreadsheet,
	CheckCircle2,
	AlertCircle,
	TrendingUp,
	TrendingDown,
	Wallet,
	RefreshCw,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { PortfolioImportPanel } from "@/components/portfolio/PortfolioImportPanel";
import { DataErrorBoundary } from "@/components/DataErrorBoundary";
import { formatCurrency } from "@/lib/format";
import type { ImportResult } from "@/hooks/use-portfolio";

interface ExternalHolding {
	id: string;
	symbol: string;
	name: string;
	assetType: string;
	quantity: string;
	avgPrice: string;
	currentValue: string;
	source: string;
	lastSyncedAt: string;
}

interface ExternalHoldingsResponse {
	holdings: ExternalHolding[];
	summary: {
		totalHoldings: number;
		totalInvested: number;
		totalCurrentValue: number;
		gainLoss: number;
		gainLossPercent: number;
	};
}

export default function PortfolioImport() {
	const [lastImportResult, setLastImportResult] = useState<ImportResult | null>(
		null,
	);
	const { toast } = useToast();

	const {
		data: existingHoldings,
		isLoading: holdingsLoading,
		refetch: refetchHoldings,
	} = useQuery<ExternalHoldingsResponse>({
		queryKey: ["/api/portfolio/external-holdings"],
		queryFn: async () => {
			const res = await fetch("/api/portfolio/external-holdings", {
				credentials: "include",
			});
			if (!res.ok) throw new Error("Failed to fetch holdings");
			return res.json();
		},
	});

	const handleImportComplete = (result: ImportResult) => {
		setLastImportResult(result);
	};

	const handleHoldingsSaved = (count: number) => {
		toast({
			title: "Holdings Saved",
			description: `Successfully saved ${count} portfolio holdings`,
		});
		queryClient.invalidateQueries({
			queryKey: ["/api/portfolio/external-holdings"],
		});
		refetchHoldings();
	};

	return (
		<DataErrorBoundary>
			<div className="container mx-auto px-4 py-6 max-w-4xl space-y-6">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-2xl font-bold text-foreground">
							Import Portfolio
						</h1>
						<p className="text-muted-foreground">
							Import your existing portfolio from broker statements, CAS, or
							URLs
						</p>
					</div>
					<Badge variant="outline" className="flex items-center gap-2">
						<FileSpreadsheet className="w-4 h-4" />
						Multi-Source
					</Badge>
				</div>

				<PortfolioImportPanel
					onImportComplete={handleImportComplete}
					onHoldingsSaved={handleHoldingsSaved}
					showWealthyImport={true}
					showCASImport={true}
					showPDFImport={true}
					showURLImport={true}
					showManualEntry={true}
				/>

				{lastImportResult?.success && lastImportResult.investor && (
					<Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
						<CardHeader>
							<CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-300">
								<CheckCircle2 className="w-5 h-5" />
								Last Import Successful
							</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="grid grid-cols-2 gap-4">
								<div>
									<p className="text-sm text-muted-foreground">Investor</p>
									<p className="font-medium">
										{lastImportResult.investor.name}
									</p>
									<p className="text-xs text-muted-foreground">
										PAN: {lastImportResult.investor.pan}
									</p>
								</div>
								{lastImportResult.investor.lastSync && (
									<div>
										<p className="text-sm text-muted-foreground">Last Sync</p>
										<p className="font-medium">
											{lastImportResult.investor.lastSync}
										</p>
									</div>
								)}
							</div>

							{lastImportResult.summary && (
								<>
									<div className="grid grid-cols-3 gap-4">
										<div className="p-3 bg-background rounded-lg">
											<p className="text-xs text-muted-foreground">
												Total Holdings
											</p>
											<p className="text-lg font-bold">
												{lastImportResult.summary.totalHoldings}
											</p>
										</div>
										<div className="p-3 bg-background rounded-lg">
											<p className="text-xs text-muted-foreground">
												Total Value
											</p>
											<p className="text-lg font-bold">
												{formatCurrency(
													lastImportResult.summary.totalCurrentValue,
												)}
											</p>
										</div>
										<div className="p-3 bg-background rounded-lg">
											<p className="text-xs text-muted-foreground">
												Allocation
											</p>
											<p className="text-sm font-medium">
												{lastImportResult.summary.equityPercent}% Equity /{" "}
												{lastImportResult.summary.debtPercent}% Debt
											</p>
										</div>
									</div>

									<div className="flex gap-4 text-sm">
										<Badge variant="secondary">
											{lastImportResult.holdings?.length || 0} holdings parsed
										</Badge>
									</div>
								</>
							)}
						</CardContent>
					</Card>
				)}

				<Card>
					<CardHeader>
						<div className="flex items-center justify-between">
							<div>
								<CardTitle className="flex items-center gap-2">
									<Wallet className="w-5 h-5" />
									Imported Holdings
								</CardTitle>
								<CardDescription>
									Your portfolio holdings from all import sources
								</CardDescription>
							</div>
							<Button
								variant="outline"
								size="sm"
								onClick={() => refetchHoldings()}
								data-testid="button-refresh"
							>
								<RefreshCw className="w-4 h-4 mr-2" />
								Refresh
							</Button>
						</div>
					</CardHeader>
					<CardContent>
						{holdingsLoading ? (
							<div className="space-y-3">
								<Skeleton className="h-16 w-full" />
								<Skeleton className="h-16 w-full" />
								<Skeleton className="h-16 w-full" />
							</div>
						) : existingHoldings && existingHoldings.holdings.length > 0 ? (
							<div className="space-y-4">
								<div className="grid grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
									<div>
										<p className="text-xs text-muted-foreground">
											Total Holdings
										</p>
										<p className="text-xl font-bold">
											{existingHoldings.summary.totalHoldings}
										</p>
									</div>
									<div>
										<p className="text-xs text-muted-foreground">
											Total Invested
										</p>
										<p className="text-xl font-bold">
											{formatCurrency(existingHoldings.summary.totalInvested)}
										</p>
									</div>
									<div>
										<p className="text-xs text-muted-foreground">
											Current Value
										</p>
										<p className="text-xl font-bold">
											{formatCurrency(
												existingHoldings.summary.totalCurrentValue,
											)}
										</p>
									</div>
									<div>
										<p className="text-xs text-muted-foreground">Gain/Loss</p>
										<p
											className={`text-xl font-bold flex items-center gap-1 ${existingHoldings.summary.gainLoss >= 0 ? "text-green-600" : "text-red-600"}`}
										>
											{existingHoldings.summary.gainLoss >= 0 ? (
												<TrendingUp className="w-4 h-4" />
											) : (
												<TrendingDown className="w-4 h-4" />
											)}
											{formatCurrency(
												Math.abs(existingHoldings.summary.gainLoss),
											)}
										</p>
									</div>
								</div>

								<div className="space-y-2 max-h-96 overflow-y-auto">
									{existingHoldings.holdings.map((holding, index) => {
										const invested =
											Number.parseFloat(holding.quantity) *
											Number.parseFloat(holding.avgPrice);
										const current = Number.parseFloat(holding.currentValue);
										const gainLoss = current - invested;
										const gainLossPercent =
											invested > 0 ? (gainLoss / invested) * 100 : 0;

										return (
											<div
												key={holding.id}
												className="p-3 border rounded-lg hover:bg-muted/50 transition-colors"
												data-testid={`holding-item-${index}`}
											>
												<div className="flex items-start justify-between">
													<div className="flex-1">
														<p
															className="font-medium text-sm truncate"
															title={holding.name || holding.symbol}
														>
															{holding.name || holding.symbol}
														</p>
														<div className="flex items-center gap-2 mt-1">
															<Badge variant="outline" className="text-xs">
																{holding.assetType}
															</Badge>
															<Badge variant="secondary" className="text-xs">
																{holding.source}
															</Badge>
															<span className="text-xs text-muted-foreground">
																{Number.parseFloat(holding.quantity).toFixed(2)}{" "}
																units
															</span>
														</div>
													</div>
													<div className="text-right">
														<p className="font-medium">
															{formatCurrency(current)}
														</p>
														<p
															className={`text-xs flex items-center justify-end gap-1 ${gainLoss >= 0 ? "text-green-600" : "text-red-600"}`}
														>
															{gainLoss >= 0 ? "+" : ""}
															{gainLossPercent.toFixed(2)}%
														</p>
													</div>
												</div>
											</div>
										);
									})}
								</div>
							</div>
						) : (
							<div className="text-center py-8">
								<FileSpreadsheet className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
								<p className="text-muted-foreground">
									No imported holdings yet
								</p>
								<p className="text-sm text-muted-foreground mt-1">
									Use the import panel above to add your portfolio holdings
								</p>
							</div>
						)}
					</CardContent>
				</Card>

				<Alert>
					<AlertCircle className="h-4 w-4" />
					<AlertTitle>Supported Import Sources</AlertTitle>
					<AlertDescription className="mt-2 space-y-2">
						<ul className="list-disc list-inside text-sm space-y-1">
							<li>
								<strong>PDF/HTML Statements:</strong> Zerodha, Groww, ICICI
								Direct, HDFC Securities, Kotak, and other brokers
							</li>
							<li>
								<strong>CAS Statements:</strong> CAMS, KFintech consolidated
								account statements
							</li>
							<li>
								<strong>Demat Statements:</strong> NSDL and CDSL demat holding
								statements
							</li>
							<li>
								<strong>URL Import:</strong> Wealthy.in and other shareable
								portfolio report URLs
							</li>
							<li>
								<strong>Manual Entry:</strong> Add holdings manually with full
								edit capability
							</li>
						</ul>
					</AlertDescription>
				</Alert>
			</div>
		</DataErrorBoundary>
	);
}
