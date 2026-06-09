import { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TabsList } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface ScrollableTabsListProps {
	children: React.ReactNode;
	className?: string;
}

export function ScrollableTabsList({
	children,
	className,
}: ScrollableTabsListProps) {
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const [showLeftArrow, setShowLeftArrow] = useState(false);
	const [showRightArrow, setShowRightArrow] = useState(false);

	const checkScroll = () => {
		const container = scrollContainerRef.current;
		if (!container) return;

		const { scrollLeft, scrollWidth, clientWidth } = container;

		// Show left arrow if scrolled right
		setShowLeftArrow(scrollLeft > 10);

		// Show right arrow if there's more content to the right
		setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
	};

	useEffect(() => {
		const container = scrollContainerRef.current;
		if (!container) return;

		// Check scroll on mount and when children change
		checkScroll();

		// Add resize observer to handle window resizing
		const resizeObserver = new ResizeObserver(checkScroll);
		resizeObserver.observe(container);

		return () => resizeObserver.disconnect();
	}, [children]);

	const scroll = (direction: "left" | "right") => {
		const container = scrollContainerRef.current;
		if (!container) return;

		const scrollAmount = 200; // Pixels to scroll
		const newScrollLeft =
			direction === "left"
				? container.scrollLeft - scrollAmount
				: container.scrollLeft + scrollAmount;

		container.scrollTo({
			left: newScrollLeft,
			behavior: "smooth",
		});

		// Update arrow visibility after scroll
		setTimeout(checkScroll, 300);
	};

	return (
		<div className="relative w-full" data-testid="scrollable-tabs-container">
			{/* Left Arrow */}
			{showLeftArrow && (
				<div className="absolute left-0 top-0 bottom-0 z-10 flex items-center pointer-events-none">
					<div className="pointer-events-auto">
						<Button
							variant="ghost"
							size="icon"
							className="h-9 w-9 rounded-full bg-background shadow-md border"
							onClick={() => scroll("left")}
							data-testid="scroll-left-button"
						>
							<ChevronLeft className="h-4 w-4" />
						</Button>
					</div>
					{/* Gradient fade effect */}
					<div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-background to-transparent pointer-events-none" />
				</div>
			)}

			{/* Scrollable Container */}
			<div
				ref={scrollContainerRef}
				className="overflow-x-auto scrollbar-hide"
				onScroll={checkScroll}
				style={{
					scrollbarWidth: "none",
					msOverflowStyle: "none",
					WebkitOverflowScrolling: "touch",
					paddingLeft: showLeftArrow ? "48px" : "0",
					paddingRight: showRightArrow ? "48px" : "0",
				}}
			>
				<TabsList className={cn("inline-flex w-auto min-w-full", className)}>
					{children}
				</TabsList>
			</div>

			{/* Right Arrow */}
			{showRightArrow && (
				<div className="absolute right-0 top-0 bottom-0 z-10 flex items-center justify-end pointer-events-none">
					{/* Gradient fade effect */}
					<div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-background to-transparent pointer-events-none" />
					<div className="pointer-events-auto">
						<Button
							variant="ghost"
							size="icon"
							className="h-9 w-9 rounded-full bg-background shadow-md border"
							onClick={() => scroll("right")}
							data-testid="scroll-right-button"
						>
							<ChevronRight className="h-4 w-4" />
						</Button>
					</div>
				</div>
			)}

			<style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
		</div>
	);
}
