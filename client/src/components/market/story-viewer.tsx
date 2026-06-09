import { useState, useMemo } from "react";
import DOMPurify from "isomorphic-dompurify";
import parse from "html-react-parser";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
	TrendingUp,
	TrendingDown,
	Minus,
	Clock,
	Star,
	Sparkles,
	BarChart3,
	Target,
	RefreshCw,
	Share2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export interface MarketStoryData {
	id: string;
	title: string;
	content: string;
	summary: string;
	sentiment: "bullish" | "bearish" | "neutral";
	confidence: number;
	keyPoints: string[];
	marketData: Array<{
		symbol: string;
		price: number;
		change: number;
		changePercent: number;
		volume?: number;
		marketCap?: number;
	}>;
	generatedAt: Date;
}

interface StoryViewerProps {
	story: MarketStoryData;
	onRefresh?: () => void;
	isRefreshing?: boolean;
}

export function StoryViewer({
	story,
	onRefresh,
	isRefreshing = false,
}: StoryViewerProps) {
	const { toast } = useToast();
	const [isSharing, setIsSharing] = useState(false);

	// Sanitize HTML content to prevent XSS attacks
	const sanitizedContent = useMemo(
		() =>
			DOMPurify.sanitize(story.content, {
				ALLOWED_TAGS: [
					"p",
					"br",
					"strong",
					"em",
					"u",
					"h1",
					"h2",
					"h3",
					"h4",
					"ul",
					"ol",
					"li",
					"blockquote",
				],
				ALLOWED_ATTR: [],
			}),
		[story.content],
	);

	const getSentimentIcon = () => {
		switch (story.sentiment) {
			case "bullish":
				return <TrendingUp className="h-5 w-5 text-green-600" />;
			case "bearish":
				return <TrendingDown className="h-5 w-5 text-red-600" />;
			default:
				return <Minus className="h-5 w-5 text-muted-foreground" />;
		}
	};

	const getSentimentColor = () => {
		switch (story.sentiment) {
			case "bullish":
				return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
			case "bearish":
				return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
			default:
				return "bg-muted text-foreground";
		}
	};

	const getConfidenceLevel = () => {
		if (story.confidence >= 0.8)
			return { label: "High", color: "text-green-600" };
		if (story.confidence >= 0.6)
			return { label: "Medium", color: "text-yellow-600" };
		return { label: "Low", color: "text-red-600" };
	};

	const handleShare = async () => {
		setIsSharing(true);
		try {
			if (navigator.share) {
				await navigator.share({
					title: story.title,
					text: story.summary,
					url: window.location.href,
				});
			} else {
				await navigator.clipboard.writeText(
					`${story.title}\n\n${story.summary}\n\n${window.location.href}`,
				);
				toast({
					title: "Story Copied!",
					description: "Market story has been copied to your clipboard",
				});
			}
		} catch (error) {
			console.error("Share failed:", error);
		} finally {
			setIsSharing(false);
		}
	};

	const confidenceInfo = getConfidenceLevel();

	return (
		<div className="space-y-6">
			{/* Story Header */}
			<Card className="border-l-4 border-l-blue-500">
				<CardHeader className="pb-4">
					<div className="flex items-start justify-between gap-4">
						<div className="flex-1">
							<div className="flex items-center gap-2 mb-2">
								<Sparkles className="h-5 w-5 text-blue-500" />
								<span className="text-sm font-medium text-blue-600">
									AI-Generated Market Story
								</span>
							</div>
							<CardTitle className="text-2xl leading-tight mb-3">
								{story.title}
							</CardTitle>

							{/* Metadata Row */}
							<div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
								<div className="flex items-center gap-1">
									<Clock className="h-4 w-4" />
									<span>{new Date(story.generatedAt).toLocaleString()}</span>
								</div>

								<div className="flex items-center gap-1">
									<Badge className={getSentimentColor()}>
										{getSentimentIcon()}
										<span className="ml-1 capitalize">{story.sentiment}</span>
									</Badge>
								</div>

								<div className="flex items-center gap-1">
									<Star className="h-4 w-4" />
									<span className={confidenceInfo.color}>
										{confidenceInfo.label} Confidence (
										{Math.round(story.confidence * 100)}%)
									</span>
								</div>
							</div>
						</div>

						{/* Action Buttons */}
						<div className="flex gap-2">
							{onRefresh && (
								<Button
									variant="outline"
									size="sm"
									onClick={onRefresh}
									disabled={isRefreshing}
									data-testid="refresh-story"
								>
									<RefreshCw
										className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
									/>
								</Button>
							)}

							<Button
								variant="outline"
								size="sm"
								onClick={handleShare}
								disabled={isSharing}
								data-testid="share-story"
							>
								<Share2 className="h-4 w-4" />
							</Button>
						</div>
					</div>
				</CardHeader>

				<CardContent>
					{/* Summary */}
					<div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mb-6">
						<h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
							Executive Summary
						</h3>
						<p className="text-blue-800 dark:text-blue-200">{story.summary}</p>
					</div>

					{/* Main Content */}
					<div
						className="prose dark:prose-invert max-w-none mb-6"
						data-testid="story-content"
					>
						{parse(sanitizedContent)}
					</div>

					{/* Key Points */}
					{story.keyPoints.length > 0 && (
						<>
							<Separator className="my-6" />
							<div>
								<h3 className="font-semibold text-foreground mb-4 flex items-center">
									<Target className="h-5 w-5 mr-2 text-orange-500" />
									Key Takeaways
								</h3>
								<ul className="space-y-2">
									{story.keyPoints.map((point, index) => (
										<li key={index} className="flex items-start gap-2">
											<div className="w-2 h-2 rounded-full bg-orange-500 mt-2 flex-shrink-0" />
											<span className="text-foreground">{point}</span>
										</li>
									))}
								</ul>
							</div>
						</>
					)}
				</CardContent>
			</Card>

			{/* Market Data Used */}
			{story.marketData.length > 0 && (
				<Card>
					<CardHeader>
						<CardTitle className="text-lg flex items-center">
							<BarChart3 className="h-5 w-5 mr-2" />
							Market Data Used in Analysis
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
							{story.marketData.slice(0, 6).map((data, index) => (
								<div key={index} className="bg-muted p-4 rounded-lg">
									<div className="flex items-center justify-between mb-2">
										<span className="font-semibold text-foreground">
											{data.symbol}
										</span>
										<span
											className={`text-sm font-medium ${
												data.change >= 0 ? "text-green-600" : "text-red-600"
											}`}
										>
											{data.change >= 0 ? "+" : ""}
											{data.changePercent.toFixed(2)}%
										</span>
									</div>
									<div className="text-lg font-bold text-foreground">
										₹{data.price.toFixed(2)}
									</div>
									{data.volume && (
										<div className="text-xs text-muted-foreground mt-1">
											Vol: {data.volume.toLocaleString()}
										</div>
									)}
								</div>
							))}
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
