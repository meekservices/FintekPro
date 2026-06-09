import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	ArrowLeft,
	ArrowRight,
	CheckCircle,
	Clock,
	XCircle,
	Save,
	Send,
} from "lucide-react";

import { TaxProvider, useTax } from "./tax-itr/TaxContext";
import { ITRSectionRenderer } from "./tax-itr/ITRSectionRenderer";
import { TaxHistoryItem, Step } from "./tax-itr/types";

function ITRWizard() {
	const {
		currentStepId,
		activeSteps,
		safeCurrentStep,
		progress,
		assessmentYear,
		recommendedForm,
		taxRegime,
		activeSubTab,
		setActiveSubTab,
		panContext,
		panLoading,
		historyData,
		isLoadingHistory,
		nextStep,
		prevStep,
		goToStep,
		visitedSteps,
		validateStep,
	} = useTax();

	const [, navigate] = useLocation();

	if (panLoading) {
		return (
			<div className="container mx-auto p-6 flex items-center justify-center min-h-[400px]">
				<div className="text-center">
					<Clock className="h-8 w-8 animate-spin mx-auto text-primary" />
					<p className="mt-2 text-muted-foreground">Loading your details...</p>
				</div>
			</div>
		);
	}

	if (activeSubTab === "history") {
		return (
			<div className="container mx-auto p-4 sm:p-6 space-y-4 max-w-5xl">
				<div className="flex items-center gap-3">
					<Button
						variant="ghost"
						size="icon"
						onClick={() => setActiveSubTab("wizard")}
					>
						<ArrowLeft className="h-5 w-5" />
					</Button>
					<div className="flex-1">
						<h1 className="text-xl sm:text-2xl font-bold">
							Tax Filing History
						</h1>
						<p className="text-sm text-muted-foreground">
							PAN: {panContext?.pan}
						</p>
					</div>
				</div>

				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Clock className="h-5 w-5 text-blue-600" />
							Tax Computation History
						</CardTitle>
						<CardDescription>
							View and manage your past tax computations and filings
						</CardDescription>
					</CardHeader>
					<CardContent>
						{isLoadingHistory ? (
							<div className="space-y-4">
								<Skeleton className="h-12 w-full" />
								<Skeleton className="h-12 w-full" />
								<Skeleton className="h-12 w-full" />
							</div>
						) : (
							<div className="rounded-md border overflow-hidden">
								<table className="w-full text-sm">
									<thead>
										<tr className="border-b bg-muted/50">
											<th className="p-3 text-left font-medium">
												Assessment Year
											</th>
											<th className="p-3 text-left font-medium">Saved Date</th>
											<th className="p-3 text-left font-medium">
												Taxable Income
											</th>
											<th className="p-3 text-left font-medium">Tax Payable</th>
											<th className="p-3 text-right font-medium">Action</th>
										</tr>
									</thead>
									<tbody>
										{historyData?.data?.map(
											(item: TaxHistoryItem): React.ReactElement => (
												<tr
													key={item.id}
													className="border-b hover:bg-muted/50"
												>
													<td className="p-3 font-medium">
														{item.assessmentYear}
													</td>
													<td className="p-3 text-muted-foreground">
														{new Date(item.savedAt).toLocaleDateString()}
													</td>
													<td className="p-3">
														₹{item.data?.taxableIncome?.toLocaleString() || 0}
													</td>
													<td className="p-3">
														₹{item.data?.taxPayable?.toLocaleString() || 0}
													</td>
													<td className="p-3 text-right">
														<Button variant="ghost" size="sm">
															View
														</Button>
													</td>
												</tr>
											),
										)}
										{(!historyData?.data || historyData.data.length === 0) && (
											<tr>
												<td
													colSpan={5}
													className="p-8 text-center text-muted-foreground"
												>
													No history found for PAN {panContext?.pan}.
												</td>
											</tr>
										)}
									</tbody>
								</table>
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		);
	}

	return (
		<div
			className="container mx-auto p-4 sm:p-6 space-y-4 max-w-5xl"
			data-testid="page-itr-self"
		>
			<div className="flex items-center gap-3">
				<Button
					variant="ghost"
					size="icon"
					onClick={(): void => navigate("/tax/itr")}
					data-testid="button-back"
				>
					<ArrowLeft className="h-5 w-5" />
				</Button>
				<div className="flex-1">
					<h1 className="text-xl sm:text-2xl font-bold">
						Self-File Income Tax Return
					</h1>
					<p className="text-sm text-muted-foreground">
						AY {assessmentYear} | {recommendedForm} |{" "}
						{taxRegime === "new" ? "New" : "Old"} Regime
					</p>
				</div>
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={(): void => setActiveSubTab("history")}
					>
						<Clock className="h-4 w-4 mr-2" /> History
					</Button>
					<Badge variant="outline" className="hidden sm:flex">
						Step {safeCurrentStep + 1}/{activeSteps.length}
					</Badge>
				</div>
			</div>

			<div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-hide">
				{activeSteps.map((step: Step, idx: number): React.ReactElement => {
					const Icon = step.icon;
					const isActive = idx === safeCurrentStep;
					const isCompleted = idx < safeCurrentStep;
					const isAccessible = isCompleted || visitedSteps.has(step.id);
					const stepValidation = isCompleted ? validateStep(step.id) : null;
					const hasErrors = stepValidation && !stepValidation.isValid;
					return (
						<div key={step.id} className="flex items-center">
							<button
								onClick={(): void => goToStep(step.id)}
								disabled={!isAccessible}
								className={`flex flex-col items-center gap-1 px-3 py-2 rounded-lg transition-all min-w-[80px] ${
									isActive
										? "bg-primary/10 text-primary ring-1 ring-primary/20"
										: isAccessible
											? "text-muted-foreground hover:bg-muted"
											: "text-muted-foreground/40 cursor-not-allowed"
								}`}
							>
								<div
									className={`p-1.5 rounded-full ${isActive ? "bg-primary text-white" : "bg-muted text-muted-foreground"}`}
								>
									<Icon className="h-3.5 w-3.5" />
								</div>
								<span className="text-[10px] font-medium whitespace-nowrap">
									{step.title}
								</span>
								{hasErrors && (
									<XCircle className="h-2.5 w-2.5 text-destructive mt-0.5" />
								)}
								{isCompleted && !hasErrors && (
									<CheckCircle className="h-2.5 w-2.5 text-green-500 mt-0.5" />
								)}
							</button>
							{idx < activeSteps.length - 1 && (
								<div className="w-4 h-[1px] bg-muted shrink-0" />
							)}
						</div>
					);
				})}
			</div>

			<div className="relative min-h-[500px] flex flex-col">
				<div className="absolute top-0 left-0 right-0 h-1 bg-muted rounded-full overflow-hidden">
					<Progress
						value={progress}
						className="h-full transition-all duration-500"
					/>
				</div>

				<div className="flex-1 mt-6">
					<ITRSectionRenderer />
				</div>

				<div className="flex items-center justify-between pt-6 border-t mt-8 bg-background sticky bottom-0 pb-2">
					<Button
						variant="outline"
						onClick={prevStep}
						disabled={safeCurrentStep === 0}
						className="gap-2"
					>
						<ArrowLeft className="h-4 w-4" /> Previous
					</Button>

					<div className="flex gap-2">
						<Button variant="outline" className="gap-2 hidden sm:flex">
							<Save className="h-4 w-4" /> Save Draft
						</Button>
						<Button onClick={nextStep} className="gap-2 min-w-[120px]">
							{safeCurrentStep === activeSteps.length - 1 ? (
								<>
									Proceed to E-File <Send className="h-4 w-4" />
								</>
							) : (
								<>
									Save & Next <ArrowRight className="h-4 w-4" />
								</>
							)}
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
}

export default function TaxITRSelfPage() {
	return (
		<TaxProvider>
			<ITRWizard />
		</TaxProvider>
	);
}
