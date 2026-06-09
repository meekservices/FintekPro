import { useQuery } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import {
	Shield as LucideShield,
	TrendingUp,
	Calendar,
	DollarSign,
	Target,
	Briefcase,
	AlertTriangle,
	CheckCircle,
	Clock,
	FileText,
} from "lucide-react";

interface RiskAssessment {
	id: string;
	userId: string;
	pan: string;
	rawScore: number;
	adjustedScore: number;
	profileCode: string;
	hasOverride: boolean;
	overrideReason?: string;
	overrideType?: string;
	originalProfileCode?: string;
	categoryScores: Array<{
		categoryCode: string;
		categoryName: string;
		weight: number;
		rawScore: number;
		weightedScore: number;
	}>;
	answers: Array<{
		questionId: string;
		questionCode: string;
		optionCode: string;
		score: number;
	}>;
	assessmentType: string;
	status: string;
	expiresAt: string;
	createdAt: string;
	clientConsentAt?: string;
}

interface AssessmentHistory {
	id: string;
	profileCode: string;
	rawScore: number;
	hasOverride: boolean;
	assessmentType: string;
	createdAt: string;
}

interface Props {
	clientId: string;
	clientPan?: string;
}

const CATEGORY_ICONS: Record<string, any> = {
	age_demographics: Calendar,
	income_stability: DollarSign,
	net_worth: TrendingUp,
	investment_horizon: Target,
	risk_tolerance: LucideShield,
	investment_experience: Briefcase,
};

const RISK_TIER_CONFIG: Record<
	string,
	{ label: string; color: string; description: string }
> = {
	RP1: {
		label: "Conservative",
		color:
			"bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800",
		description: "Focused on capital preservation",
	},
	RP2: {
		label: "Moderately Conservative",
		color:
			"bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800",
		description: "Prefers stability with some growth",
	},
	RP3: {
		label: "Moderate",
		color:
			"bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 border-yellow-200 dark:border-yellow-800",
		description: "Balanced growth and safety",
	},
	RP4: {
		label: "Moderately Aggressive",
		color:
			"bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 border-orange-200 dark:border-orange-800",
		description: "Seeks higher returns",
	},
	RP5: {
		label: "Aggressive",
		color:
			"bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800",
		description: "Maximum growth orientation",
	},
};

export function AgentRiskBreakdown({ clientId, clientPan }: Props) {
	const {
		data: assessmentResponse,
		isLoading,
		error,
	} = useQuery<{ success: boolean; data: RiskAssessment }>({
		queryKey: ["/api/sebi-risk-profiling/assessment", clientId],
		enabled: !!clientId,
	});
	const assessment = assessmentResponse?.data;

	const { data: historyResponse } = useQuery<{
		success: boolean;
		data: AssessmentHistory[];
	}>({
		queryKey: ["/api/sebi-risk-profiling/history", clientId],
		enabled: !!clientId,
	});
	const history = historyResponse?.data;

	const { data: eligibilityResponse } = useQuery<{
		success: boolean;
		data: Array<{ productType: string; isEligible: boolean; reason: string }>;
	}>({
		queryKey: [
			"/api/sebi-risk-profiling/eligibility/matrix",
			assessment?.profileCode,
		],
		enabled: !!assessment?.profileCode,
	});
	const eligibility = eligibilityResponse?.data;

	if (isLoading) {
		return (
			<Card>
				<CardContent className="flex justify-center py-8">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
				</CardContent>
			</Card>
		);
	}

	if (error || !assessment) {
		return (
			<Card>
				<CardContent className="py-8">
					<Alert>
						<AlertTriangle className="h-4 w-4" />
						<AlertTitle>No Risk Profile Found</AlertTitle>
						<AlertDescription>
							This client has not completed their risk assessment. Please guide
							them to complete the SEBI risk profiling questionnaire.
						</AlertDescription>
					</Alert>
				</CardContent>
			</Card>
		);
	}

	const tierConfig =
		RISK_TIER_CONFIG[assessment.profileCode] || RISK_TIER_CONFIG.RP3;
	const isExpired = new Date(assessment.expiresAt) < new Date();
	const daysUntilExpiry = Math.ceil(
		(new Date(assessment.expiresAt).getTime() - Date.now()) /
			(1000 * 60 * 60 * 24),
	);

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle className="flex items-center gap-2">
								<LucideShield className="h-5 w-5" />
								Client Risk Profile
							</CardTitle>
							<CardDescription>
								PAN: {clientPan || assessment.pan} | Last assessed:{" "}
								{new Date(assessment.createdAt).toLocaleDateString()}
							</CardDescription>
						</div>
						<div className="text-right">
							<Badge
								className={`text-lg px-4 py-2 ${tierConfig.color}`}
								data-testid="badge-client-risk-tier"
							>
								{assessment.profileCode} - {tierConfig.label}
							</Badge>
							{isExpired ? (
								<p className="text-xs text-red-500 mt-1">
									Profile expired - revalidation required
								</p>
							) : daysUntilExpiry <= 30 ? (
								<p className="text-xs text-amber-500 mt-1">
									Expires in {daysUntilExpiry} days
								</p>
							) : null}
						</div>
					</div>
				</CardHeader>
				<CardContent className="space-y-6">
					<div className="grid grid-cols-3 gap-4">
						<div className="p-4 bg-muted/50 rounded-lg text-center">
							<p className="text-2xl font-bold">
								{Math.round(assessment.rawScore)}
							</p>
							<p className="text-sm text-muted-foreground">Raw Score</p>
						</div>
						<div className="p-4 bg-muted/50 rounded-lg text-center">
							<p className="text-2xl font-bold">
								{Math.round(assessment.adjustedScore || assessment.rawScore)}
							</p>
							<p className="text-sm text-muted-foreground">Adjusted Score</p>
						</div>
						<div className="p-4 bg-muted/50 rounded-lg text-center">
							<p className="text-2xl font-bold">
								{assessment.categoryScores?.length || 0}
							</p>
							<p className="text-sm text-muted-foreground">
								Categories Assessed
							</p>
						</div>
					</div>

					{assessment.hasOverride && (
						<Alert className="border-orange-200 bg-orange-50 dark:bg-orange-900/20">
							<AlertTriangle className="h-4 w-4 text-orange-600" />
							<AlertTitle className="text-orange-800 dark:text-orange-200">
								SEBI Override Applied
							</AlertTitle>
							<AlertDescription className="text-orange-700 dark:text-orange-300">
								<p>
									<strong>Override Type:</strong> {assessment.overrideType}
								</p>
								<p>
									<strong>Reason:</strong> {assessment.overrideReason}
								</p>
								{assessment.originalProfileCode && (
									<p>
										<strong>Original Profile:</strong>{" "}
										{assessment.originalProfileCode} → {assessment.profileCode}
									</p>
								)}
							</AlertDescription>
						</Alert>
					)}

					<Separator />

					<Accordion type="single" collapsible className="w-full">
						<AccordionItem value="category-breakdown">
							<AccordionTrigger>
								<span className="flex items-center gap-2">
									<TrendingUp className="h-4 w-4" />
									Category Score Breakdown
								</span>
							</AccordionTrigger>
							<AccordionContent>
								<div className="space-y-4 pt-2">
									{assessment.categoryScores?.map((cat) => {
										const Icon =
											CATEGORY_ICONS[cat.categoryCode] || LucideShield;
										return (
											<div key={cat.categoryCode} className="space-y-2">
												<div className="flex items-center justify-between">
													<div className="flex items-center gap-2">
														<Icon className="h-4 w-4 text-primary" />
														<span className="font-medium">
															{cat.categoryName}
														</span>
														<Badge variant="outline" className="text-xs">
															{cat.weight}% weight
														</Badge>
													</div>
													<span className="font-medium">
														{Math.round(cat.rawScore)}/100
													</span>
												</div>
												<div className="flex items-center gap-2">
													<Progress
														value={cat.rawScore}
														className="h-2 flex-1"
													/>
													<span className="text-xs text-muted-foreground w-20 text-right">
														Weighted: {cat.weightedScore.toFixed(1)}
													</span>
												</div>
											</div>
										);
									})}
								</div>
							</AccordionContent>
						</AccordionItem>

						<AccordionItem value="eligibility">
							<AccordionTrigger>
								<span className="flex items-center gap-2">
									<CheckCircle className="h-4 w-4" />
									Product Eligibility
								</span>
							</AccordionTrigger>
							<AccordionContent>
								<div className="grid grid-cols-2 gap-2 pt-2">
									{eligibility?.map((product) => (
										<div
											key={product.productType}
											className={`p-3 rounded-lg border ${
												product.isEligible
													? "border-green-200 bg-green-50 dark:bg-green-900/20"
													: "border-red-200 bg-red-50 dark:bg-red-900/20"
											}`}
										>
											<div className="flex items-center justify-between">
												<span className="font-medium text-sm">
													{product.productType}
												</span>
												{product.isEligible ? (
													<CheckCircle className="h-4 w-4 text-green-600" />
												) : (
													<AlertTriangle className="h-4 w-4 text-red-600" />
												)}
											</div>
										</div>
									))}
								</div>
							</AccordionContent>
						</AccordionItem>

						<AccordionItem value="history">
							<AccordionTrigger>
								<span className="flex items-center gap-2">
									<Clock className="h-4 w-4" />
									Assessment History
								</span>
							</AccordionTrigger>
							<AccordionContent>
								{history && history.length > 0 ? (
									<Table>
										<TableHeader>
											<TableRow>
												<TableHead>Date</TableHead>
												<TableHead>Profile</TableHead>
												<TableHead>Score</TableHead>
												<TableHead>Type</TableHead>
												<TableHead>Override</TableHead>
											</TableRow>
										</TableHeader>
										<TableBody>
											{history.map((h) => (
												<TableRow key={h.id}>
													<TableCell>
														{new Date(h.createdAt).toLocaleDateString()}
													</TableCell>
													<TableCell>
														<Badge variant="outline">{h.profileCode}</Badge>
													</TableCell>
													<TableCell>{Math.round(h.rawScore)}</TableCell>
													<TableCell className="capitalize">
														{h.assessmentType}
													</TableCell>
													<TableCell>
														{h.hasOverride ? (
															<Badge variant="secondary">Yes</Badge>
														) : (
															<span className="text-muted-foreground">-</span>
														)}
													</TableCell>
												</TableRow>
											))}
										</TableBody>
									</Table>
								) : (
									<p className="text-sm text-muted-foreground py-4">
										No previous assessments
									</p>
								)}
							</AccordionContent>
						</AccordionItem>

						<AccordionItem value="answers">
							<AccordionTrigger>
								<span className="flex items-center gap-2">
									<FileText className="h-4 w-4" />
									Questionnaire Responses
								</span>
							</AccordionTrigger>
							<AccordionContent>
								<div className="space-y-2 pt-2">
									{assessment.answers?.map((answer, idx) => (
										<div
											key={idx}
											className="flex items-center justify-between p-2 bg-muted/30 rounded text-sm"
										>
											<span className="font-mono">{answer.questionCode}</span>
											<div className="flex items-center gap-2">
												<Badge variant="outline">{answer.optionCode}</Badge>
												<span className="text-muted-foreground">
													Score: {answer.score}
												</span>
											</div>
										</div>
									))}
								</div>
							</AccordionContent>
						</AccordionItem>
					</Accordion>
				</CardContent>
			</Card>
		</div>
	);
}
