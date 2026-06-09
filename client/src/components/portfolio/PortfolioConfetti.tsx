import { useEffect, useState, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import Confetti from "react-confetti";
import confetti from "canvas-confetti";

interface PortfolioPerformance {
	totalValue: number;
	totalReturns: number;
	returnPercentage: number;
	todaysGain: number;
	todaysGainPercentage: number;
	previousValue?: number;
	milestoneReached?: string;
}

interface PortfolioConfettiProps {
	portfolioId: string;
	enabled?: boolean;
}

export function PortfolioConfetti({
	portfolioId,
	enabled = true,
}: PortfolioConfettiProps) {
	const [showConfetti, setShowConfetti] = useState(false);
	const [lastCelebration, setLastCelebration] = useState<string | null>(null);
	const [windowSize, setWindowSize] = useState({ width: 0, height: 0 });
	const celebrationTimeoutRef = useRef<NodeJS.Timeout>();
	const previousPerformanceRef = useRef<PortfolioPerformance | null>(null);

	// Get window size for confetti canvas
	useEffect(() => {
		const updateWindowSize = () => {
			setWindowSize({
				width: window.innerWidth,
				height: window.innerHeight,
			});
		};

		updateWindowSize();
		window.addEventListener("resize", updateWindowSize);
		return () => window.removeEventListener("resize", updateWindowSize);
	}, []);

	// Fetch real-time portfolio performance
	const { data: performance } = useQuery<PortfolioPerformance>({
		queryKey: ["/api/portfolios", portfolioId, "performance"],
		refetchInterval: 2000, // Update every 2 seconds for real-time tracking
		enabled,
	});

	// Advanced confetti animations for different milestones
	const triggerAdvancedConfetti = useCallback(
		(type: string, milestone: string) => {
			const duration = 3000;
			const animationEnd = Date.now() + duration;
			const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

			switch (type) {
				case "profit_milestone": {
					// Golden celebration for profit milestones
					const interval = setInterval(() => {
						const timeLeft = animationEnd - Date.now();
						if (timeLeft <= 0) {
							clearInterval(interval);
							return;
						}

						const particleCount = 50 * (timeLeft / duration);
						confetti({
							...defaults,
							particleCount,
							origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
							colors: ["#FFD700", "#FFA500", "#FF6347"],
						});
						confetti({
							...defaults,
							particleCount,
							origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
							colors: ["#FFD700", "#FFA500", "#FF6347"],
						});
					}, 250);
					break;
				}

				case "percentage_gain": {
					// Multi-burst celebration for percentage milestones
					const count = 200;
					const origins = [
						{ x: 0.25, y: 0.35 },
						{ x: 0.75, y: 0.35 },
						{ x: 0.5, y: 0.65 },
					];

					origins.forEach((origin, index) => {
						setTimeout(() => {
							confetti({
								...defaults,
								particleCount: count / origins.length,
								origin,
								colors: ["#00FF00", "#32CD32", "#90EE90", "#98FB98"],
							});
						}, index * 100);
					});
					break;
				}

				case "all_time_high": {
					// Special fireworks-style celebration
					const firework = () => {
						confetti({
							...defaults,
							particleCount: 100,
							startVelocity: 45,
							spread: 50,
							origin: { x: 0.5, y: 0.4 },
							colors: ["#FF1493", "#00BFFF", "#FFD700", "#FF6347", "#98FB98"],
						});
					};

					firework();
					setTimeout(firework, 500);
					setTimeout(firework, 1000);
					break;
				}

				case "daily_gain":
					// Gentle celebration for daily gains
					confetti({
						...defaults,
						particleCount: 30,
						spread: 60,
						origin: { y: 0.8 },
						colors: ["#87CEEB", "#98FB98", "#F0E68C"],
					});
					break;

				default:
					// Default celebration
					confetti({
						...defaults,
						particleCount: 100,
						origin: { y: 0.6 },
					});
			}

			// Store milestone to prevent duplicate celebrations
			setLastCelebration(`${type}-${milestone}-${Date.now()}`);

			// Clear confetti after animation
			celebrationTimeoutRef.current = setTimeout(() => {
				setShowConfetti(false);
			}, duration);
		},
		[],
	);

	// Check for performance milestones and trigger confetti
	useEffect(() => {
		if (!performance || !enabled) return;

		const previous = previousPerformanceRef.current;
		let shouldCelebrate = false;
		let celebrationType = "";
		let milestone = "";

		if (previous) {
			// Check for profit milestones (₹1L, ₹5L, ₹10L, ₹25L, ₹50L, ₹1Cr increments)
			const profitMilestones = [
				100000, 500000, 1000000, 2500000, 5000000, 10000000, 25000000, 50000000,
				100000000,
			];
			const currentReturns = Math.floor(performance.totalReturns);
			const previousReturns = Math.floor(previous.totalReturns);

			for (const milestoneAmount of profitMilestones) {
				if (
					currentReturns >= milestoneAmount &&
					previousReturns < milestoneAmount
				) {
					shouldCelebrate = true;
					celebrationType = "profit_milestone";
					milestone = `₹${(milestoneAmount / 100000).toFixed(0)}L${milestoneAmount >= 10000000 ? " Crore" : " Lakh"}`;
					break;
				}
			}

			// Check for percentage gain milestones (10%, 25%, 50%, 75%, 100%, 200%, etc.)
			if (!shouldCelebrate) {
				const percentageMilestones = [10, 25, 50, 75, 100, 150, 200, 300, 500];
				const currentPercent = Math.floor(performance.returnPercentage);
				const previousPercent = Math.floor(previous.returnPercentage);

				for (const percentMilestone of percentageMilestones) {
					if (
						currentPercent >= percentMilestone &&
						previousPercent < percentMilestone
					) {
						shouldCelebrate = true;
						celebrationType = "percentage_gain";
						milestone = `${percentMilestone}%`;
						break;
					}
				}
			}

			// Check for all-time high portfolio value
			if (
				!shouldCelebrate &&
				performance.totalValue > (previous.totalValue || 0)
			) {
				const valueIncrease = performance.totalValue - previous.totalValue;
				const significantIncrease = valueIncrease >= 50000; // ₹50K+ increase

				if (significantIncrease) {
					shouldCelebrate = true;
					celebrationType = "all_time_high";
					milestone = `₹${(performance.totalValue / 100000).toFixed(1)}L`;
				}
			}

			// Check for significant daily gains (₹10K+, 2%+)
			if (!shouldCelebrate && performance.todaysGain > 0) {
				const significantDailyGain =
					performance.todaysGain >= 10000 ||
					performance.todaysGainPercentage >= 2;

				if (
					significantDailyGain &&
					performance.todaysGain > (previous.todaysGain || 0)
				) {
					shouldCelebrate = true;
					celebrationType = "daily_gain";
					milestone = `+₹${(performance.todaysGain / 1000).toFixed(1)}K today`;
				}
			}
		}

		// Trigger celebration if milestone reached and not recently celebrated
		if (shouldCelebrate) {
			const celebrationKey = `${celebrationType}-${milestone}`;
			if (lastCelebration !== celebrationKey) {
				setShowConfetti(true);
				triggerAdvancedConfetti(celebrationType, milestone);

				// Show milestone message
				console.log(`🎉 Portfolio Milestone Reached: ${milestone}`);
			}
		}

		// Store current performance for next comparison
		previousPerformanceRef.current = performance;
	}, [performance, enabled, lastCelebration, triggerAdvancedConfetti]);

	// Cleanup timeout on unmount
	useEffect(() => {
		return () => {
			if (celebrationTimeoutRef.current) {
				clearTimeout(celebrationTimeoutRef.current);
			}
		};
	}, []);

	if (!enabled || !showConfetti) return null;

	return (
		<Confetti
			width={windowSize.width}
			height={windowSize.height}
			recycle={false}
			numberOfPieces={0} // We use canvas-confetti for animations
			style={{
				position: "fixed",
				top: 0,
				left: 0,
				width: "100%",
				height: "100%",
				pointerEvents: "none",
				zIndex: 9999,
			}}
		/>
	);
}

// Helper function for confetti
function randomInRange(min: number, max: number) {
	return Math.random() * (max - min) + min;
}

// Manual confetti trigger for testing
export const triggerCelebrationConfetti = (
	type: "profit" | "percentage" | "milestone" = "profit",
) => {
	const duration = 2000;
	const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };

	switch (type) {
		case "profit":
			confetti({
				...defaults,
				particleCount: 150,
				origin: { y: 0.6 },
				colors: ["#FFD700", "#FFA500", "#FF6347"],
			});
			break;
		case "percentage":
			confetti({
				...defaults,
				particleCount: 100,
				origin: { y: 0.5 },
				colors: ["#00FF00", "#32CD32", "#90EE90"],
			});
			break;
		case "milestone":
			confetti({
				...defaults,
				particleCount: 200,
				startVelocity: 45,
				origin: { y: 0.4 },
				colors: ["#FF1493", "#00BFFF", "#FFD700", "#FF6347", "#98FB98"],
			});
			break;
	}
};
