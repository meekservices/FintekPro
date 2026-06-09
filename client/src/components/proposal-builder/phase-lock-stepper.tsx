import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
	Lock,
	Unlock,
	Check,
	ChevronRight,
	AlertTriangle,
	User,
	Clock,
	Target,
	Briefcase,
	BarChart3,
	Sparkles,
	RefreshCw,
	Scale,
	FileText,
} from "lucide-react";

type ProposalPhase =
	| "risk_profile"
	| "investment_horizon"
	| "goal"
	| "portfolio_input"
	| "analysis"
	| "recommendation"
	| "rebalancing"
	| "verdict"
	| "report";

interface PhaseValidation {
	phase: ProposalPhase;
	isLocked: boolean;
	reason?: string;
	prerequisites: ProposalPhase[];
	missingPrerequisites: ProposalPhase[];
}

interface ProposalFlowStatus {
	proposalId: string;
	currentPhase: ProposalPhase;
	phases: PhaseValidation[];
	canProgress: boolean;
	blockReason?: string;
}

const PHASE_CONFIG: Record<
	ProposalPhase,
	{ label: string; icon: React.ReactNode; description: string }
> = {
	risk_profile: {
		label: "Risk Profile",
		icon: <User className="h-4 w-4" />,
		description: "Assess client risk tolerance",
	},
	investment_horizon: {
		label: "Investment Horizon",
		icon: <Clock className="h-4 w-4" />,
		description: "Set investment time frame",
	},
	goal: {
		label: "Goal Selection",
		icon: <Target className="h-4 w-4" />,
		description: "Define investment objectives",
	},
	portfolio_input: {
		label: "Portfolio Input",
		icon: <Briefcase className="h-4 w-4" />,
		description: "Enter current holdings",
	},
	analysis: {
		label: "Portfolio Analysis",
		icon: <BarChart3 className="h-4 w-4" />,
		description: "Analyze existing portfolio",
	},
	recommendation: {
		label: "AI Recommendations",
		icon: <Sparkles className="h-4 w-4" />,
		description: "Generate investment suggestions",
	},
	rebalancing: {
		label: "Rebalancing",
		icon: <RefreshCw className="h-4 w-4" />,
		description: "Optimize portfolio allocation",
	},
	verdict: {
		label: "Verdict Assignment",
		icon: <Scale className="h-4 w-4" />,
		description: "Assign BUY/HOLD/SELL verdicts",
	},
	report: {
		label: "Report Generation",
		icon: <FileText className="h-4 w-4" />,
		description: "Generate final proposal",
	},
};

interface PhaseLockStepperProps {
	proposalId: string;
	onPhaseClick?: (phase: ProposalPhase) => void;
	currentActivePhase?: ProposalPhase;
}

export function PhaseLockStepper({
	proposalId,
	onPhaseClick,
	currentActivePhase,
}: PhaseLockStepperProps) {
	const {
		data: flowStatus,
		isLoading,
		error,
	} = useQuery<ProposalFlowStatus>({
		queryKey: ["/api/proposal-builder/flow-state", proposalId],
		queryFn: async () => {
			const response = await fetch(
				`/api/proposal-builder/flow-state/${proposalId}`,
			);
			if (!response.ok) throw new Error("Failed to fetch flow status");
			return response.json();
		},
		enabled: !!proposalId,
	});

	if (isLoading) {
		return (
			<Card>
				<CardContent className="py-6">
					<div className="flex items-center justify-center text-muted-foreground">
						Loading phase status...
					</div>
				</CardContent>
			</Card>
		);
	}

	if (error || !flowStatus) {
		return null;
	}

	const phases = Object.keys(PHASE_CONFIG) as ProposalPhase[];
	const currentPhaseIndex = phases.indexOf(flowStatus.currentPhase);

	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle className="text-lg flex items-center gap-2">
					Proposal Progress
					{flowStatus.blockReason && (
						<Badge variant="destructive" className="text-xs">
							Blocked
						</Badge>
					)}
				</CardTitle>
			</CardHeader>
			<CardContent>
				{flowStatus.blockReason && (
					<Alert variant="destructive" className="mb-4">
						<AlertTriangle className="h-4 w-4" />
						<AlertDescription>{flowStatus.blockReason}</AlertDescription>
					</Alert>
				)}

				<div className="space-y-2">
					{phases.map((phase, index) => {
						const config = PHASE_CONFIG[phase];
						const validation = flowStatus.phases.find((p) => p.phase === phase);
						const isCompleted = index < currentPhaseIndex;
						const isCurrent = phase === flowStatus.currentPhase;
						const isLocked = validation?.isLocked ?? false;
						const isActive = phase === currentActivePhase;

						return (
							<TooltipProvider key={phase}>
								<Tooltip>
									<TooltipTrigger asChild>
										<div
											className={`
                        flex items-center gap-3 p-3 rounded-lg border transition-all
                        ${isActive ? "border-primary bg-primary/5" : "border-transparent"}
                        ${isLocked ? "opacity-50 cursor-not-allowed" : "hover:bg-muted cursor-pointer"}
                        ${isCurrent && !isLocked ? "border-primary/50 bg-primary/5" : ""}
                      `}
											onClick={() => !isLocked && onPhaseClick?.(phase)}
										>
											<div
												className={`
                        flex items-center justify-center w-8 h-8 rounded-full
                        ${isCompleted ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" : ""}
                        ${isCurrent && !isLocked ? "bg-primary text-primary-foreground" : ""}
                        ${isLocked ? "bg-muted text-muted-foreground" : ""}
                        ${!isCompleted && !isCurrent && !isLocked ? "bg-muted text-muted-foreground" : ""}
                      `}
											>
												{isCompleted ? (
													<Check className="h-4 w-4" />
												) : isLocked ? (
													<Lock className="h-4 w-4" />
												) : (
													config.icon
												)}
											</div>

											<div className="flex-1 min-w-0">
												<div className="flex items-center gap-2">
													<span
														className={`font-medium ${isLocked ? "text-muted-foreground" : ""}`}
													>
														{config.label}
													</span>
													{isCompleted && (
														<Badge
															variant="outline"
															className="text-xs bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400"
														>
															Complete
														</Badge>
													)}
													{isCurrent && !isLocked && (
														<Badge className="text-xs">Current</Badge>
													)}
												</div>
												<p className="text-xs text-muted-foreground truncate">
													{isLocked ? validation?.reason : config.description}
												</p>
											</div>

											{!isLocked && !isCompleted && (
												<ChevronRight className="h-4 w-4 text-muted-foreground" />
											)}
										</div>
									</TooltipTrigger>
									<TooltipContent side="right" className="max-w-xs">
										<div>
											<p className="font-medium">{config.label}</p>
											<p className="text-xs text-muted-foreground">
												{config.description}
											</p>
											{isLocked &&
												validation?.missingPrerequisites &&
												validation.missingPrerequisites.length > 0 && (
													<div className="mt-2">
														<p className="text-xs font-medium text-destructive">
															Missing:
														</p>
														<ul className="text-xs text-muted-foreground">
															{validation.missingPrerequisites.map((prereq) => (
																<li key={prereq}>
																	• {PHASE_CONFIG[prereq].label}
																</li>
															))}
														</ul>
													</div>
												)}
										</div>
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						);
					})}
				</div>
			</CardContent>
		</Card>
	);
}
