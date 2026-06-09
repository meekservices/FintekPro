import { useQuery, useMutation } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
	FileText,
	Lock,
	Check,
	AlertCircle,
	Sparkles,
	Loader2,
} from "lucide-react";

interface ReportSectionStatus {
	code: string;
	name: string;
	order: number;
	dependencyMet: boolean;
	reason?: string;
	missingDependencies: string[];
	isEnabled: boolean;
	enabledByAgent: boolean;
	enabledByAi: boolean;
}

interface SmartReportBuilderProps {
	proposalId: string;
}

export function SmartReportBuilder({ proposalId }: SmartReportBuilderProps) {
	const { toast } = useToast();

	const { data: sectionsData, isLoading } = useQuery<{
		proposalId: string;
		sections: ReportSectionStatus[];
	}>({
		queryKey: ["/api/proposal-builder/report-sections", proposalId],
		queryFn: async () => {
			const response = await fetch(
				`/api/proposal-builder/report-sections/${proposalId}`,
			);
			if (!response.ok) throw new Error("Failed to fetch report sections");
			return response.json();
		},
		enabled: !!proposalId,
	});

	const toggleSection = useMutation({
		mutationFn: async ({
			sectionCode,
			enabled,
		}: { sectionCode: string; enabled: boolean }) => {
			return apiRequest(
				`/api/proposal-builder/report-sections/${proposalId}/toggle`,
				{
					method: "POST",
					body: JSON.stringify({ sectionCode, enabled, byAgent: true }),
				},
			);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["/api/proposal-builder/report-sections", proposalId],
			});
		},
		onError: (error: any) => {
			toast({
				title: "Toggle Failed",
				description: error.message,
				variant: "destructive",
			});
		},
	});

	const autoSelect = useMutation({
		mutationFn: async () => {
			return apiRequest(
				`/api/proposal-builder/report-sections/${proposalId}/auto-select`,
				{
					method: "POST",
				},
			);
		},
		onSuccess: (data: any) => {
			queryClient.invalidateQueries({
				queryKey: ["/api/proposal-builder/report-sections", proposalId],
			});
			toast({
				title: "Auto-Selection Complete",
				description: `${data.enabledSections?.length || 0} sections enabled based on available data`,
			});
		},
	});

	const sections = sectionsData?.sections || [];
	const enabledCount = sections.filter((s) => s.isEnabled).length;
	const availableCount = sections.filter((s) => s.dependencyMet).length;

	return (
		<Card>
			<CardHeader>
				<div className="flex items-center justify-between">
					<div>
						<CardTitle className="flex items-center gap-2">
							<FileText className="h-5 w-5" />
							Report Builder
						</CardTitle>
						<CardDescription>
							Select sections to include in the proposal report
						</CardDescription>
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={() => autoSelect.mutate()}
						disabled={autoSelect.isPending}
					>
						{autoSelect.isPending ? (
							<Loader2 className="h-4 w-4 mr-2 animate-spin" />
						) : (
							<Sparkles className="h-4 w-4 mr-2" />
						)}
						AI Auto-Select
					</Button>
				</div>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="flex items-center gap-4 text-sm">
					<div className="flex items-center gap-1">
						<Check className="h-4 w-4 text-green-600" />
						<span>{enabledCount} enabled</span>
					</div>
					<div className="flex items-center gap-1">
						<AlertCircle className="h-4 w-4 text-muted-foreground" />
						<span>{availableCount} available</span>
					</div>
					<div className="flex items-center gap-1">
						<Lock className="h-4 w-4 text-muted-foreground" />
						<span>{sections.length - availableCount} locked</span>
					</div>
				</div>

				<div className="space-y-2">
					{sections.map((section) => (
						<TooltipProvider key={section.code}>
							<div
								className={`
                  flex items-center justify-between p-3 rounded-lg border
                  ${!section.dependencyMet ? "opacity-50 bg-muted" : "hover:bg-muted/50"}
                `}
							>
								<div className="flex items-center gap-3">
									<div
										className={`
                    flex items-center justify-center w-8 h-8 rounded-full
                    ${section.isEnabled ? "bg-green-100 dark:bg-green-900/30" : "bg-muted"}
                  `}
									>
										{!section.dependencyMet ? (
											<Lock className="h-4 w-4 text-muted-foreground" />
										) : section.isEnabled ? (
											<Check className="h-4 w-4 text-green-600" />
										) : (
											<FileText className="h-4 w-4 text-muted-foreground" />
										)}
									</div>
									<div>
										<div className="flex items-center gap-2">
											<span className="font-medium">{section.name}</span>
											{section.enabledByAi && !section.enabledByAgent && (
												<Badge variant="secondary" className="text-xs">
													<Sparkles className="h-3 w-3 mr-1" />
													AI
												</Badge>
											)}
										</div>
										{!section.dependencyMet && section.reason && (
											<p className="text-xs text-muted-foreground">
												{section.reason}
											</p>
										)}
									</div>
								</div>

								<div className="flex items-center gap-2">
									{!section.dependencyMet ? (
										<Tooltip>
											<TooltipTrigger>
												<Badge variant="outline" className="text-xs">
													<Lock className="h-3 w-3 mr-1" />
													Locked
												</Badge>
											</TooltipTrigger>
											<TooltipContent side="left" className="max-w-xs">
												<p className="font-medium text-destructive">
													Missing Data
												</p>
												<p className="text-xs">{section.reason}</p>
												{section.missingDependencies.length > 0 && (
													<ul className="text-xs mt-1">
														{section.missingDependencies.map((dep) => (
															<li key={dep}>• {dep.replace(/_/g, " ")}</li>
														))}
													</ul>
												)}
											</TooltipContent>
										</Tooltip>
									) : (
										<Switch
											checked={section.isEnabled}
											onCheckedChange={(checked) =>
												toggleSection.mutate({
													sectionCode: section.code,
													enabled: checked,
												})
											}
										/>
									)}
								</div>
							</div>
						</TooltipProvider>
					))}
				</div>
			</CardContent>
		</Card>
	);
}
