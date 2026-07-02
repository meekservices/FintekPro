import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";

interface SectorEntry {
	sector: string;
	count: number | string;
	pinned?: boolean;
}

interface SectorDistributionPanelProps {
	sectors: SectorEntry[];
	onSectorClick?: (sector: string) => void;
	defaultShowAll?: boolean;
	collapseThreshold?: number;
}

const DEFAULT_THRESHOLD = 20;

/**
 * Collapsible grid of sector distribution tiles.
 * Shows `collapseThreshold` (default 20) sectors, expandable via button.
 * REIT / InvIT are always pinned at the bottom regardless of count.
 */
export function SectorDistributionPanel({
	sectors,
	onSectorClick,
	defaultShowAll = false,
	collapseThreshold = DEFAULT_THRESHOLD,
}: SectorDistributionPanelProps) {
	const [showAll, setShowAll] = useState(defaultShowAll);

	const pinnedSectors = sectors.filter((d) => d.pinned);
	const normalSectors = sectors.filter((d) => !d.pinned);
	const total = normalSectors.reduce((s, x) => s + Number(x.count), 0);

	const visibleNormal = showAll
		? normalSectors
		: normalSectors.slice(0, collapseThreshold);

	const hasMore = normalSectors.length > collapseThreshold;

	function renderTile(d: SectorEntry) {
		const isReit   = d.sector === "REIT";
		const isInvit  = d.sector === "InvIT";
		const isPinned = isReit || isInvit;
		const pct      = !isPinned && total > 0
			? (Number(d.count) / total) * 100
			: null;

		return (
			<div
				key={d.sector}
				className={`flex items-center justify-between p-2 rounded-md transition-colors cursor-pointer text-xs ${
					isReit
						? "bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20"
						: isInvit
						? "bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20"
						: "bg-muted/30 hover:bg-muted/50"
				}`}
				onClick={() => {
					if (isReit) {
						window.location.href = "/reit-invit?tab=reits";
					} else if (isInvit) {
						window.location.href = "/reit-invit?tab=invits";
					} else if (onSectorClick) {
						onSectorClick(d.sector);
					}
				}}
			>
				<span
					className={`truncate flex-1 mr-2 font-medium ${
						isReit
							? "text-amber-600 dark:text-amber-400"
							: isInvit
							? "text-violet-600 dark:text-violet-400"
							: ""
					}`}
					title={d.sector}
				>
					{isReit ? "REIT" : isInvit ? "InvIT" : d.sector}
				</span>
				<div className="flex items-center gap-1 shrink-0">
					{pct !== null && (
						<span className="text-[9px] text-muted-foreground">
							{pct.toFixed(1)}%
						</span>
					)}
					<Badge
						variant="secondary"
						className={`text-[10px] h-4 px-1.5 ${
							isReit
								? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
								: isInvit
								? "bg-violet-500/20 text-violet-700 dark:text-violet-300"
								: ""
						}`}
					>
						{Number(d.count)}
					</Badge>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-3">
			<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
				{visibleNormal.map(renderTile)}
				{pinnedSectors.map(renderTile)}
			</div>

			{hasMore && (
				<div className="flex justify-center pt-1">
					<Button
						variant="ghost"
						size="sm"
						className="text-xs text-muted-foreground hover:text-foreground gap-1"
						onClick={() => setShowAll((prev) => !prev)}
					>
						{showAll ? (
							<>
								<ChevronUp className="h-3.5 w-3.5" />
								Show Less
							</>
						) : (
							<>
								<ChevronDown className="h-3.5 w-3.5" />
								Show All {normalSectors.length} Sectors
							</>
						)}
					</Button>
				</div>
			)}
		</div>
	);
}
