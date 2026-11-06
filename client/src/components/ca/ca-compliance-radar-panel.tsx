import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
	Calendar,
	Copy,
} from "lucide-react";

export function CAComplianceRadarPanel() {
	const { toast } = useToast();
	const [selectedRegime, setSelectedRegime] = useState("ALL");

	const { data: calendarData, isLoading } = useQuery<{
		success: boolean;
		deadlines: any[];
	}>({
		queryKey: ["/api/ca/calendar/deadlines"],
	});

	const deadlines = calendarData?.deadlines || [];

	const filtered = selectedRegime === "ALL"
		? deadlines
		: deadlines.filter((d) => d.regime === selectedRegime);

	return (
		<div className="space-y-6">
			<Card>
				<CardHeader className="py-3 px-4">
					<div className="flex items-center justify-between">
						<div>
							<CardTitle className="text-sm font-semibold flex items-center gap-2">
								<Calendar className="w-4 h-4 text-primary" /> Master Statutory Compliance Radar
							</CardTitle>
							<CardDescription className="text-xs">
								Live tracker for GST, Direct Tax, TDS/TCS, and MCA/ROC deadlines with automated client notification payloads.
							</CardDescription>
						</div>
						<div className="flex gap-1.5">
							{["ALL", "GST", "INCOME_TAX", "TDS_TCS", "ROC_MCA"].map((r) => (
								<Button
									key={r}
									size="sm"
									variant={selectedRegime === r ? "default" : "outline"}
									className="h-7 text-[11px] px-2.5"
									onClick={() => setSelectedRegime(r)}
								>
									{r.replace(/_/g, " ")}
								</Button>
							))}
						</div>
					</div>
				</CardHeader>
				<CardContent className="px-4 pb-4 space-y-3">
					{isLoading ? (
						<div className="py-12 text-center text-xs text-muted-foreground">Loading compliance radar...</div>
					) : filtered.length === 0 ? (
						<div className="py-12 text-center text-xs text-muted-foreground">No deadlines found for this category.</div>
					) : (
						<div className="space-y-3">
							{filtered.map((item) => (
								<div key={item.id} className="p-3 bg-muted/20 border rounded-lg flex items-start justify-between gap-4">
									<div className="space-y-1 flex-1">
										<div className="flex items-center gap-2">
											<Badge variant="outline" className="text-[10px] font-mono">
												{item.regime}
											</Badge>
											<p className="text-xs font-bold text-foreground">{item.title}</p>
											<Badge
												variant={item.urgency === "OVERDUE" ? "destructive" : item.urgency === "DUE_THIS_WEEK" ? "secondary" : "default"}
												className="text-[10px] py-0"
											>
												{item.daysRemaining > 0 ? `${item.daysRemaining} Days Left` : "DUE TODAY"}
											</Badge>
										</div>
										<p className="text-[11px] text-muted-foreground">
											Form: <span className="font-semibold text-foreground">{item.formOrChallan}</span> | Ref: {item.statutorySection}
										</p>
										<p className="text-[11px] text-muted-foreground">
											Applies to: {item.applicability}
										</p>
										<p className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
											⚠️ Late Penalty: {item.penaltyConsequence}
										</p>
									</div>

									<div className="flex flex-col items-end gap-1.5">
										<div className="text-right">
											<p className="text-xs font-bold text-primary font-mono">{item.dueDate}</p>
											<p className="text-[10px] text-muted-foreground">Statutory Deadline</p>
										</div>
										<Button
											size="sm"
											variant="secondary"
											className="h-7 text-[11px] flex items-center gap-1"
											onClick={() => {
												navigator.clipboard.writeText(item.clientReminderTemplate);
												toast({
													title: "Reminder Copied",
													description: "WhatsApp client reminder template copied to clipboard",
												});
											}}
										>
											<Copy className="w-3 h-3" /> Copy WhatsApp Alert
										</Button>
									</div>
								</div>
							))}
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

