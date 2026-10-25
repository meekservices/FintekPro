import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Layers } from "lucide-react";
import {
	MACRO_SECTORS,
	mapGranularToMacroSector,
} from "@shared/sector-taxonomy";

export interface SectorEntry {
	sector: string;
	count: number | string;
	pinned?: boolean;
}

export interface MacroSectorEntry {
	macroSector: string;
	count: number | string;
	subSectors?: Array<{ sector: string; count: number | string }>;
}

export interface SectorDistributionPanelProps {
	sectors: SectorEntry[];
	macroSectors?: MacroSectorEntry[];
	onSectorClick?: (sectorOrMacro: string, subSector?: string) => void;
	onMacroSectorClick?: (macroSector: string, subSector?: string) => void;
	defaultShowAll?: boolean;
	collapseThreshold?: number;
}

const DEFAULT_THRESHOLD = 20;

export function SectorDistributionPanel({
	sectors,
	macroSectors: incomingMacroSectors,
	onSectorClick,
	onMacroSectorClick,
	defaultShowAll = false,
	collapseThreshold = DEFAULT_THRESHOLD,
}: SectorDistributionPanelProps) {
	const [viewType, setViewType] = useState<"macro" | "granular">("macro");
	const [showAll, setShowAll] = useState(defaultShowAll);
	const [expandedMacro, setExpandedMacro] = useState<string | null>(null);

	const pinnedSectors = sectors.filter((d) => d.pinned);
	const normalSectors = sectors.filter((d) => !d.pinned && d.sector && d.sector.trim() !== "");
	const totalStocks = normalSectors.reduce((s, x) => s + Number(x.count), 0);

	// Derive macro sectors with subsectors if not passed directly from backend
	const computedMacroSectors: MacroSectorEntry[] = useMemo(() => {
		if (incomingMacroSectors && incomingMacroSectors.length > 0) {
			return incomingMacroSectors;
		}

		const map = new Map<
			string,
			{ macroSector: string; count: number; subSectors: Array<{ sector: string; count: number }> }
		>();

		for (const m of MACRO_SECTORS) {
			map.set(m, { macroSector: m, count: 0, subSectors: [] });
		}

		for (const s of normalSectors) {
			const macro = mapGranularToMacroSector(s.sector);
			const entry = map.get(macro) || { macroSector: macro, count: 0, subSectors: [] };
			const countNum = Number(s.count) || 0;
			entry.count += countNum;
			entry.subSectors.push({ sector: s.sector, count: countNum });
			map.set(macro, entry);
		}

		return Array.from(map.values())
			.filter((m) => m.count > 0)
			.sort((a, b) => Number(b.count) - Number(a.count))
			.map((m) => ({
				...m,
				subSectors: m.subSectors.sort((a, b) => b.count - a.count),
			}));
	}, [incomingMacroSectors, normalSectors]);

	const visibleNormal = showAll
		? normalSectors
		: normalSectors.slice(0, collapseThreshold);

	const hasMore = normalSectors.length > collapseThreshold;

	function renderGranularTile(d: SectorEntry) {
		const isReit = d.sector === "REIT";
		const isInvit = d.sector === "InvIT";
		const isPinned = isReit || isInvit;
		const pct = !isPinned && totalStocks > 0 ? (Number(d.count) / totalStocks) * 100 : null;

		return (
			<button
				type="button"
				key={d.sector}
				className={`w-full text-left flex items-center justify-between p-2 rounded-md transition-colors cursor-pointer text-xs ${
					isReit
						? "bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20"
						: isInvit
						? "bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/20"
						: "bg-muted/30 hover:bg-muted/50"
				}`}
				onClick={() => {
					if (onSectorClick) {
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
						<span className="text-[9px] text-muted-foreground">{pct.toFixed(1)}%</span>
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
			</button>
		);
	}

	return (
		<div className="space-y-3">
			{/* ── View Toggle Header ── */}
			<div className="flex items-center justify-between pb-1 border-b border-border/40">
				<div className="flex items-center gap-1.5">
					<span className="text-xs font-semibold text-foreground">Sector Breakdown:</span>
					<div className="flex items-center rounded-md border border-border/60 p-0.5 bg-muted/20">
						<button
							type="button"
							onClick={() => setViewType("macro")}
							className={`text-[11px] px-2 py-0.5 rounded font-medium transition-all ${
								viewType === "macro"
									? "bg-primary text-primary-foreground shadow-xs"
									: "text-muted-foreground hover:text-foreground"
							}`}
						>
							12 Macro Sectors
						</button>
						<button
							type="button"
							onClick={() => setViewType("granular")}
							className={`text-[11px] px-2 py-0.5 rounded font-medium transition-all ${
								viewType === "granular"
									? "bg-primary text-primary-foreground shadow-xs"
									: "text-muted-foreground hover:text-foreground"
							}`}
						>
							All Sub-sectors ({normalSectors.length})
						</button>
					</div>
				</div>

				<span className="text-[11px] text-muted-foreground">
					Total: <strong>{totalStocks.toLocaleString()}</strong> listed stocks
				</span>
			</div>

			{/* ── View 1: 12 Macro Sectors with Cascading Sub-sectors Drilldown ── */}
			{viewType === "macro" ? (
				<div className="space-y-2">
					<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
						{computedMacroSectors.map((m) => {
							const isExpanded = expandedMacro === m.macroSector;
							const pct = totalStocks > 0 ? (Number(m.count) / totalStocks) * 100 : 0;
							const subCount = m.subSectors?.length ?? 0;

							return (
								<div
									key={m.macroSector}
									className={`rounded-lg border transition-all ${
										isExpanded
											? "border-primary/50 bg-primary/5 shadow-xs"
											: "border-border/60 bg-muted/20 hover:border-border hover:bg-muted/40"
									}`}
								>
									{/* Macro Sector Tile Bar */}
									<div className="p-2.5 flex items-center justify-between gap-2">
										<button
											type="button"
											className="flex-1 text-left cursor-pointer group"
											onClick={() => {
												if (onMacroSectorClick) onMacroSectorClick(m.macroSector);
												else onSectorClick?.(m.macroSector);
											}}
											title={`Filter by Macro Sector: ${m.macroSector}`}
										>
											<div className="font-semibold text-xs text-foreground group-hover:text-primary transition-colors flex items-center gap-1.5">
												<Layers className="h-3 w-3 text-primary/70 shrink-0" />
												<span className="truncate">{m.macroSector}</span>
											</div>
											<div className="text-[10px] text-muted-foreground flex items-center gap-2 mt-0.5">
												<span>{pct.toFixed(1)}% of market</span>
												{subCount > 0 && <span>· {subCount} sub-sectors</span>}
											</div>
										</button>

										<div className="flex items-center gap-1.5 shrink-0">
											<Badge variant="secondary" className="text-[10px] h-5 font-bold">
												{Number(m.count)}
											</Badge>

											{subCount > 0 && (
												<button
													type="button"
													onClick={() => setExpandedMacro(isExpanded ? null : m.macroSector)}
													className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
													title={isExpanded ? "Collapse sub-sectors" : "Expand sub-sectors"}
												>
													{isExpanded ? (
														<ChevronUp className="h-3.5 w-3.5" />
													) : (
														<ChevronDown className="h-3.5 w-3.5" />
													)}
												</button>
											)}
										</div>
									</div>

									{/* Expanded Sub-sectors Grid */}
									{isExpanded && m.subSectors && m.subSectors.length > 0 && (
										<div className="px-2.5 pb-2.5 pt-1 border-t border-border/40 space-y-1.5 bg-background/50 rounded-b-lg">
											<div className="text-[10px] font-medium text-muted-foreground">
												Select Sub-sector / Granular Industry:
											</div>
											<div className="flex flex-wrap gap-1 max-h-36 overflow-y-auto pr-1">
												{m.subSectors.map((sub) => (
													<button
														key={sub.sector}
														type="button"
														onClick={() => {
															if (onMacroSectorClick) onMacroSectorClick(m.macroSector, sub.sector);
															else onSectorClick?.(m.macroSector, sub.sector);
														}}
														className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-muted/60 hover:bg-primary/20 hover:text-primary border border-border/60 transition-colors"
													>
														<span className="truncate max-w-[140px]">{sub.sector}</span>
														<span className="text-[9px] opacity-70">({sub.count})</span>
													</button>
												))}
											</div>
										</div>
									)}
								</div>
							);
						})}
					</div>

					{/* Pinned Real Asset Tiles */}
					{pinnedSectors.length > 0 && (
						<div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-border/40">
							{pinnedSectors.map(renderGranularTile)}
						</div>
					)}
				</div>
			) : (
				/* ── View 2: Granular 106 Sub-sectors Flat Grid ── */
				<div className="space-y-3">
					<div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
						{visibleNormal.map(renderGranularTile)}
						{pinnedSectors.map(renderGranularTile)}
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
										Show All {normalSectors.length} Sub-sectors
									</>
								)}
							</Button>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
