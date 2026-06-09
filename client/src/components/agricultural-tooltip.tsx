import { useState, useRef, useEffect } from "react";
import {
	AgriculturalTrivia,
	getTriviaByTerm,
	getRandomTrivia,
} from "@/data/agricultural-trivia";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
	Lightbulb,
	TrendingUp,
	Cloud,
	History,
	Cpu,
	IndianRupee,
	CreditCard,
} from "lucide-react";

interface AgriculturalTooltipProps {
	children: React.ReactNode;
	searchTerm?: string;
	className?: string;
	delay?: number;
}

const categoryIcons = {
	commodity: TrendingUp,
	weather: Cloud,
	trading: TrendingUp,
	history: History,
	technology: Cpu,
	equity: IndianRupee,
	bonds: CreditCard,
	debt: CreditCard,
};

const categoryColors = {
	commodity:
		"bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
	weather: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
	trading:
		"bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
	history:
		"bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
	technology: "bg-muted text-foreground",
	equity:
		"bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
	bonds:
		"bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
	debt: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export function AgriculturalTooltip({
	children,
	searchTerm,
	className = "",
	delay = 500,
}: AgriculturalTooltipProps) {
	const [isVisible, setIsVisible] = useState(false);
	const [trivia, setTrivia] = useState<AgriculturalTrivia | null>(null);
	const [position, setPosition] = useState({ x: 0, y: 0 });
	const timeoutRef = useRef<NodeJS.Timeout | null>(null);
	const triggerRef = useRef<HTMLDivElement>(null);
	const tooltipRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (searchTerm) {
			const relatedTrivia = getTriviaByTerm(searchTerm);
			if (relatedTrivia.length > 0) {
				setTrivia(relatedTrivia[0]);
			} else {
				setTrivia(getRandomTrivia());
			}
		} else {
			setTrivia(getRandomTrivia());
		}
	}, [searchTerm]);

	const calculatePosition = (event: React.MouseEvent) => {
		const triggerRect = triggerRef.current?.getBoundingClientRect();
		if (!triggerRect) return;

		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;
		const tooltipWidth = 320;
		const tooltipHeight = 200;

		let x = event.clientX + 10;
		let y = event.clientY - 10;

		// Adjust if tooltip would go off-screen
		if (x + tooltipWidth > viewportWidth) {
			x = event.clientX - tooltipWidth - 10;
		}
		if (y + tooltipHeight > viewportHeight) {
			y = event.clientY - tooltipHeight - 10;
		}
		if (x < 0) x = 10;
		if (y < 0) y = 10;

		setPosition({ x, y });
	};

	const handleMouseEnter = (event: React.MouseEvent) => {
		calculatePosition(event);
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
		}
		timeoutRef.current = setTimeout(() => {
			setIsVisible(true);
		}, delay);
	};

	const handleMouseLeave = () => {
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
		}
		setIsVisible(false);
	};

	const handleMouseMove = (event: React.MouseEvent) => {
		if (isVisible) {
			calculatePosition(event);
		}
	};

	useEffect(() => {
		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}
		};
	}, []);

	if (!trivia) {
		return <div className={className}>{children}</div>;
	}

	const IconComponent = categoryIcons[trivia.category];

	return (
		<>
			<span
				ref={triggerRef}
				className={`${className} cursor-help inline-block relative`}
				onMouseEnter={handleMouseEnter}
				onMouseLeave={handleMouseLeave}
				onMouseMove={handleMouseMove}
				data-testid={`agricultural-tooltip-trigger-${trivia.id}`}
			>
				{children}
			</span>

			{isVisible && (
				<div
					ref={tooltipRef}
					className="fixed z-50 pointer-events-none"
					style={{
						left: `${position.x}px`,
						top: `${position.y}px`,
					}}
					data-testid={`agricultural-tooltip-content-${trivia.id}`}
				>
					<Card className="w-80 shadow-lg border-2 bg-card animate-in fade-in-0 zoom-in-95 duration-200">
						<CardHeader className="pb-2">
							<div className="flex items-start justify-between gap-2">
								<CardTitle className="text-sm font-semibold text-foreground leading-tight">
									{trivia.title}
								</CardTitle>
								<div className="flex items-center gap-1 flex-shrink-0">
									<IconComponent className="h-4 w-4 text-muted-foreground" />
									<Badge
										variant="secondary"
										className={`text-xs ${categoryColors[trivia.category]}`}
									>
										{trivia.category}
									</Badge>
								</div>
							</div>
						</CardHeader>
						<CardContent className="pt-0">
							<p className="text-xs text-muted-foreground leading-relaxed mb-3">
								{trivia.content}
							</p>

							{trivia.funFact && (
								<div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-md p-2 mb-3">
									<div className="flex items-start gap-2">
										<Lightbulb className="h-3 w-3 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
										<p className="text-xs text-amber-800 dark:text-amber-200 font-medium">
											{trivia.funFact}
										</p>
									</div>
								</div>
							)}

							<div className="flex flex-wrap gap-1">
								{trivia.relatedTerms.slice(0, 4).map((term) => (
									<Badge
										key={term}
										variant="outline"
										className="text-xs py-0 px-2 h-5"
									>
										{term}
									</Badge>
								))}
							</div>
						</CardContent>
					</Card>
				</div>
			)}
		</>
	);
}
