import { useState, useEffect } from "react";
import { Info, IndianRupee, AlertTriangle, XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { StepValidation } from "@/pages/tax-itr/types";
import { format } from "date-fns";

export function formatCurrency(amount: number | string | undefined): string {
	if (amount === undefined || amount === null) return "₹0";
	const num = typeof amount === "string" ? Number.parseFloat(amount) : amount;
	if (Number.isNaN(num)) return "₹0";
	return new Intl.NumberFormat("en-IN", {
		style: "currency",
		currency: "INR",
		maximumFractionDigits: 0,
	}).format(num);
}

export function formatLakhs(amount: number | string | undefined): string {
	if (amount === undefined || amount === null) return "₹0";
	const num = typeof amount === "string" ? Number.parseFloat(amount) : amount;
	if (Number.isNaN(num)) return "₹0";
	if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
	if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
	return formatCurrency(num);
}

export function FieldHint({ text }: { text: string }): React.ReactElement {
	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>
					<Info className="h-3.5 w-3.5 text-muted-foreground cursor-help inline-block ml-1" />
				</TooltipTrigger>
				<TooltipContent side="top" className="max-w-[280px] text-xs">
					<p>{text}</p>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

export function CurrencyInput({
	id,
	value,
	onChange,
	placeholder = "Enter amount",
	max,
	hint,
	disabled,
	"data-testid": testId,
}: {
	id: string;
	value: number;
	onChange: (val: number) => void;
	placeholder?: string;
	max?: number;
	hint?: string;
	disabled?: boolean;
	"data-testid"?: string;
}): React.ReactElement {
	const [localVal, setLocalVal] = useState(value ? String(value) : "");
	const [warning, setWarning] = useState<string | null>(null);

	useEffect(() => {
		setLocalVal(value ? String(value) : "");
	}, [value]);

	const handleChange = (raw: string) => {
		const cleaned = raw.replace(/[^0-9]/g, "");
		setLocalVal(cleaned);
		const num = Number(cleaned) || 0;
		if (max && num > max) {
			setWarning(
				`Maximum limit is ₹${max.toLocaleString("en-IN")}. Amount will be capped.`,
			);
			onChange(max);
		} else {
			setWarning(null);
			onChange(num);
		}
	};

	return (
		<div className="space-y-1">
			<div className="relative">
				<IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
				<Input
					id={id}
					type="text"
					inputMode="numeric"
					className={`pl-9 ${warning ? "border-amber-400 focus-visible:ring-amber-400" : ""}`}
					value={localVal}
					onChange={(e) => handleChange(e.target.value)}
					placeholder={placeholder}
					disabled={disabled}
					data-testid={testId}
				/>
			</div>
			{warning && (
				<p className="text-xs text-amber-600 flex items-center gap-1">
					<AlertTriangle className="h-3 w-3" /> {warning}
				</p>
			)}
			{hint && !warning && (
				<p className="text-xs text-muted-foreground">{hint}</p>
			)}
		</div>
	);
}

export function ValidationBanner({
	validation,
}: { validation: StepValidation }): React.ReactElement | null {
	if (validation.isValid && validation.warnings.length === 0) return null;
	return (
		<div className="space-y-2">
			{validation.errors.map((err, i) => (
				<Alert
					key={`err-${i}`}
					className="bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800"
				>
					<XCircle className="h-4 w-4 text-red-600" />
					<AlertDescription className="text-red-700 dark:text-red-300">
						{err}
					</AlertDescription>
				</Alert>
			))}
			{validation.warnings.map((warn, i) => (
				<Alert
					key={`warn-${i}`}
					className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800"
				>
					<AlertTriangle className="h-4 w-4 text-amber-600" />
					<AlertDescription className="text-amber-700 dark:text-amber-300">
						{warn}
					</AlertDescription>
				</Alert>
			))}
		</div>
	);
}
