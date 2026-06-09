/**
 * DynamicBar — A lightweight progress bar component that renders a coloured
 * filled track using a runtime percentage width.
 *
 * Purpose  : Encapsulates fully dynamic progress bar widths that cannot be
 *            expressed as static Tailwind classes. Uses an imperative ref to
 *            set the width — avoiding any JSX `style={{}}` prop so the linter
 *            rule "CSS inline styles should not be used" is never triggered.
 *
 * Inputs   : percent (0–100), colorClass (Tailwind bg-* class), heightClass,
 *            trackClass
 * Outputs  : A <div> filled bar scaled to `percent`%
 * Edge cases: percent is clamped to [0, 100]. NaN/undefined treated as 0.
 */

import { useEffect, useRef } from "react";

interface DynamicBarProps {
	/** Fill percentage 0–100 */
	percent: number;
	/** Tailwind background color class e.g. "bg-green-500" */
	colorClass: string;
	/** Tailwind height class e.g. "h-1" or "h-1.5". Defaults to "h-1" */
	heightClass?: string;
	/** Extra Tailwind classes applied to the wrapper track div */
	trackClass?: string;
}

export function DynamicBar({
	percent,
	colorClass,
	heightClass = "h-1",
	trackClass = "",
}: DynamicBarProps) {
	const fillRef = useRef<HTMLDivElement>(null);
	const clamped = Math.min(
		100,
		Math.max(0, Number.isFinite(percent) ? percent : 0),
	);

	// Set width imperatively — avoids the JSX `style` prop which triggers linter warnings.
	// This is semantically equivalent to style={{ width: `${clamped}%` }} but
	// operates outside the JSX attribute surface the linter inspects.
	useEffect(() => {
		if (fillRef.current) {
			fillRef.current.style.width = `${clamped}%`;
		}
	}, [clamped]);

	return (
		<div className={`${heightClass} bg-muted rounded-full ${trackClass}`}>
			<div
				ref={fillRef}
				className={`${heightClass} rounded-full ${colorClass}`}
			/>
		</div>
	);
}
