import * as React from "react";

import { cn } from "@/lib/utils";

export type TableDensity = "compact" | "normal" | "relaxed";

const TableDensityContext = React.createContext<TableDensity>("normal");

export const useTableDensity = () => React.useContext(TableDensityContext);

export interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
	density?: TableDensity;
}

const Table = React.forwardRef<HTMLTableElement, TableProps>(
	({ className, density = "normal", ...props }, ref) => (
		<TableDensityContext.Provider value={density}>
			<div className="relative w-full overflow-auto rounded-md border border-border">
				<table
					ref={ref}
					className={cn(
						"w-full caption-bottom text-sm tabular-nums",
						density === "compact" && "text-xs",
						className,
					)}
					{...props}
				/>
			</div>
		</TableDensityContext.Provider>
	),
);
Table.displayName = "Table";

const TableHeader = React.forwardRef<
	HTMLTableSectionElement,
	React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
	<thead
		ref={ref}
		className={cn("bg-muted/80 backdrop-blur-sm [&_tr]:border-b", className)}
		{...props}
	/>
));
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<
	HTMLTableSectionElement,
	React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
	<tbody
		ref={ref}
		className={cn("[&_tr:last-child]:border-0", className)}
		{...props}
	/>
));
TableBody.displayName = "TableBody";

const TableFooter = React.forwardRef<
	HTMLTableSectionElement,
	React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
	<tfoot
		ref={ref}
		className={cn(
			"border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
			className,
		)}
		{...props}
	/>
));
TableFooter.displayName = "TableFooter";

const TableRow = React.forwardRef<
	HTMLTableRowElement,
	React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
	<tr
		ref={ref}
		className={cn(
			"border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
			className,
		)}
		{...props}
	/>
));
TableRow.displayName = "TableRow";

export interface TableHeadProps
	extends React.ThHTMLAttributes<HTMLTableCellElement> {
	align?: "left" | "center" | "right";
}

const TableHead = React.forwardRef<HTMLTableCellElement, TableHeadProps>(
	({ className, align = "left", ...props }, ref) => {
		const density = useTableDensity();
		const heightClass =
			density === "compact"
				? "h-8 px-2.5 py-1 text-[11px]"
				: density === "relaxed"
					? "h-12 px-4 py-3 text-sm"
					: "h-9 px-3 py-1.5 text-xs";

		return (
			<th
				ref={ref}
				className={cn(
					heightClass,
					"align-middle font-semibold text-muted-foreground uppercase tracking-wider [&:has([role=checkbox])]:pr-0",
					align === "right" && "text-right tabular-nums",
					align === "center" && "text-center",
					align === "left" && "text-left",
					className,
				)}
				{...props}
			/>
		);
	},
);
TableHead.displayName = "TableHead";

export interface TableCellProps
	extends React.TdHTMLAttributes<HTMLTableCellElement> {
	align?: "left" | "center" | "right";
}

const TableCell = React.forwardRef<HTMLTableCellElement, TableCellProps>(
	({ className, align = "left", ...props }, ref) => {
		const density = useTableDensity();
		const paddingClass =
			density === "compact"
				? "p-2 text-xs"
				: density === "relaxed"
					? "p-4 text-sm"
					: "py-2.5 px-3 text-sm";

		return (
			<td
				ref={ref}
				className={cn(
					paddingClass,
					"align-middle [&:has([role=checkbox])]:pr-0",
					align === "right" && "text-right tabular-nums font-mono",
					align === "center" && "text-center",
					align === "left" && "text-left",
					className,
				)}
				{...props}
			/>
		);
	},
);
TableCell.displayName = "TableCell";

const TableCaption = React.forwardRef<
	HTMLTableCaptionElement,
	React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
	<caption
		ref={ref}
		className={cn("mt-4 text-sm text-muted-foreground", className)}
		{...props}
	/>
));
TableCaption.displayName = "TableCaption";

/** Institutional segmented toggle for switching grid density */
export function TableDensityToggle({
	density: controlledDensity,
	onDensityChange,
	className,
}: {
	density?: TableDensity;
	onDensityChange?: (d: TableDensity) => void;
	className?: string;
}) {
	const [internalDensity, setInternalDensity] = React.useState<TableDensity>(
		controlledDensity || "normal",
	);
	const density = controlledDensity ?? internalDensity;

	const handleDensityChange = (d: TableDensity) => {
		if (onDensityChange) {
			onDensityChange(d);
		} else {
			setInternalDensity(d);
		}
	};

	return (
		<div
			className={cn(
				"inline-flex items-center rounded-lg border border-border bg-muted/30 p-0.5 text-xs",
				className,
			)}
			data-testid="table-density-toggle"
		>
			<button
				type="button"
				onClick={() => handleDensityChange("compact")}
				className={cn(
					"px-2 py-0.5 font-medium rounded transition-colors",
					density === "compact"
						? "bg-background shadow-xs text-foreground font-semibold"
						: "text-muted-foreground hover:text-foreground",
				)}
			>
				Compact
			</button>
			<button
				type="button"
				onClick={() => handleDensityChange("normal")}
				className={cn(
					"px-2 py-0.5 font-medium rounded transition-colors",
					density === "normal"
						? "bg-background shadow-xs text-foreground font-semibold"
						: "text-muted-foreground hover:text-foreground",
				)}
			>
				Standard
			</button>
			<button
				type="button"
				onClick={() => handleDensityChange("relaxed")}
				className={cn(
					"px-2 py-0.5 font-medium rounded transition-colors",
					density === "relaxed"
						? "bg-background shadow-xs text-foreground font-semibold"
						: "text-muted-foreground hover:text-foreground",
				)}
			>
				Comfortable
			</button>
		</div>
	);
}

export {
	Table,
	TableHeader,
	TableBody,
	TableFooter,
	TableHead,
	TableRow,
	TableCell,
	TableCaption,
};
