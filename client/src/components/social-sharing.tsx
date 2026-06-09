import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import {
	Share2,
	Twitter,
	Linkedin,
	Facebook,
	MessageSquare,
	Copy,
	Award,
	TrendingUp,
	Target,
	BookOpen,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";

interface Achievement {
	id: string;
	name: string;
	description: string;
	icon?: string;
	badgeImage?: string;
	points: number;
	difficulty: "beginner" | "intermediate" | "advanced" | "expert";
	categoryId?: string;
	category?: {
		name: string;
		color?: string;
		icon?: string;
	};
	shareTemplate?: string;
}

interface UserAchievement {
	id: string;
	achievementId: string;
	userId: string;
	earnedAt: string;
	isCompleted: boolean;
	sharedCount: number;
	lastSharedAt?: string;
	achievement?: Achievement;
}

interface SocialSharingProps {
	achievement: Achievement;
	userAchievement?: UserAchievement;
	userId?: string;
}

export function SocialSharing({
	achievement,
	userAchievement,
	userId,
}: SocialSharingProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [copySuccess, setCopySuccess] = useState(false);
	const { toast } = useToast();
	const queryClient = useQueryClient();

	const createSocialShareMutation = useMutation({
		mutationFn: async (shareData: {
			platform: string;
			shareUrl?: string;
			shareContent: string;
		}) => {
			return await apiRequest("POST", "/api/achievements/share", {
				achievementId: achievement.id,
				userId,
				...shareData,
			});
		},
		onSuccess: () => {
			toast({
				title: "Shared Successfully!",
				description: "Your achievement has been shared to social media.",
			});
			queryClient.invalidateQueries({
				queryKey: ["/api/achievements", userId],
			});
		},
		onError: (error: Error) => {
			toast({
				title: "Sharing Failed",
				description: `Failed to share achievement: ${error.message}`,
				variant: "destructive",
			});
		},
	});

	const getDifficultyColor = (difficulty: string) => {
		switch (difficulty) {
			case "beginner":
				return "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200";
			case "intermediate":
				return "bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200";
			case "advanced":
				return "bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200";
			case "expert":
				return "bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-200";
			default:
				return "bg-muted text-foreground";
		}
	};

	const getAchievementIcon = (category: string) => {
		switch (category.toLowerCase()) {
			case "portfolio":
				return <TrendingUp className="h-8 w-8" />;
			case "learning":
				return <BookOpen className="h-8 w-8" />;
			case "trading":
				return <Target className="h-8 w-8" />;
			default:
				return <Award className="h-8 w-8" />;
		}
	};

	const generateShareContent = () => {
		const template =
			achievement.shareTemplate ||
			`🎉 I just earned the "${achievement.name}" achievement on FintekPro! ${achievement.description}`;

		const difficultyEmoji =
			{
				beginner: "🌱",
				intermediate: "🚀",
				advanced: "⚡",
				expert: "🏆",
			}[achievement.difficulty] || "🏅";

		const categoryEmoji =
			{
				portfolio: "📈",
				learning: "📚",
				trading: "💹",
				savings: "💰",
				investment: "📊",
			}[achievement.categoryId?.toLowerCase() || "investment"] || "🎯";

		return `${template}\n\n${categoryEmoji} ${achievement.points} points earned\n${difficultyEmoji} ${achievement.difficulty.charAt(0).toUpperCase() + achievement.difficulty.slice(1)} Level\n\n#InvestmentJourney #FintekPro #WealthBuilding #Achievement`;
	};

	const shareToTwitter = () => {
		const content = generateShareContent();
		const hashtags = [
			"InvestmentJourney",
			"FintekPro",
			"WealthBuilding",
			"Achievement",
		];
		const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(content)}&hashtags=${hashtags.join(",")}`;
		window.open(url, "_blank");

		createSocialShareMutation.mutate({
			platform: "twitter",
			shareUrl: url,
			shareContent: content,
		});
	};

	const shareToInstagram = () => {
		const content = generateShareContent();
		// Instagram doesn't have direct web sharing, so we'll copy content and show instructions
		navigator.clipboard.writeText(content).then(() => {
			toast({
				title: "Content Copied!",
				description:
					"The achievement content has been copied. Now open Instagram and paste it in your story or post.",
			});
		});

		createSocialShareMutation.mutate({
			platform: "instagram",
			shareContent: content,
		});
	};

	const shareToLinkedIn = () => {
		const content = generateShareContent();
		const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent("https://fintekpro.com")}&summary=${encodeURIComponent(content)}`;
		window.open(url, "_blank");

		createSocialShareMutation.mutate({
			platform: "linkedin",
			shareUrl: url,
			shareContent: content,
		});
	};

	const shareToFacebook = () => {
		const content = generateShareContent();
		const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent("https://fintekpro.com")}&quote=${encodeURIComponent(content)}`;
		window.open(url, "_blank");

		createSocialShareMutation.mutate({
			platform: "facebook",
			shareUrl: url,
			shareContent: content,
		});
	};

	const shareToWhatsApp = () => {
		const content = generateShareContent();
		const url = `https://wa.me/?text=${encodeURIComponent(content)}`;
		window.open(url, "_blank");

		createSocialShareMutation.mutate({
			platform: "whatsapp",
			shareUrl: url,
			shareContent: content,
		});
	};

	const copyToClipboard = async () => {
		try {
			await navigator.clipboard.writeText(generateShareContent());
			setCopySuccess(true);
			setTimeout(() => setCopySuccess(false), 2000);

			createSocialShareMutation.mutate({
				platform: "clipboard",
				shareContent: generateShareContent(),
			});

			toast({
				title: "Copied to Clipboard!",
				description: "Achievement content copied to clipboard.",
			});
		} catch (err) {
			toast({
				title: "Copy Failed",
				description: "Failed to copy to clipboard.",
				variant: "destructive",
			});
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			<DialogTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					className="gap-2"
					data-testid="button-share-achievement"
				>
					<Share2 className="h-4 w-4" />
					Share Achievement
				</Button>
			</DialogTrigger>

			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<Share2 className="h-5 w-5" />
						Share Your Achievement
					</DialogTitle>
				</DialogHeader>

				<div className="space-y-6">
					{/* Achievement Preview */}
					<Card>
						<CardContent className="p-4">
							<div className="flex items-center gap-4">
								<div className="flex-shrink-0">
									{achievement.badgeImage ? (
										<img
											src={achievement.badgeImage}
											alt={achievement.name}
											className="w-16 h-16 rounded-lg"
										/>
									) : (
										<div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-lg flex items-center justify-center text-foreground">
											{getAchievementIcon(achievement.category?.name || "")}
										</div>
									)}
								</div>

								<div className="flex-1">
									<h3 className="font-semibold text-lg">{achievement.name}</h3>
									<p className="text-sm text-muted-foreground mb-2">
										{achievement.description}
									</p>

									<div className="flex items-center gap-2">
										<Badge
											className={getDifficultyColor(achievement.difficulty)}
										>
											{achievement.difficulty}
										</Badge>
										<Badge variant="secondary">
											{achievement.points} points
										</Badge>
										{userAchievement?.sharedCount &&
											userAchievement.sharedCount > 0 && (
												<Badge variant="outline">
													Shared {userAchievement.sharedCount} times
												</Badge>
											)}
									</div>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Share Content Preview */}
					<div className="bg-muted p-4 rounded-lg">
						<h4 className="font-medium mb-2">Share Preview:</h4>
						<p className="text-sm whitespace-pre-line">
							{generateShareContent()}
						</p>
					</div>

					{/* Social Media Buttons */}
					<div className="grid grid-cols-2 gap-3">
						<Button
							onClick={shareToTwitter}
							className="gap-2 bg-blue-500 hover:bg-blue-600"
							data-testid="button-share-twitter"
						>
							<Twitter className="h-4 w-4" />
							Twitter
						</Button>

						<Button
							onClick={shareToLinkedIn}
							className="gap-2 bg-blue-700 hover:bg-blue-800"
							data-testid="button-share-linkedin"
						>
							<Linkedin className="h-4 w-4" />
							LinkedIn
						</Button>

						<Button
							onClick={shareToFacebook}
							className="gap-2 bg-blue-600 hover:bg-blue-700"
							data-testid="button-share-facebook"
						>
							<Facebook className="h-4 w-4" />
							Facebook
						</Button>

						<Button
							onClick={shareToWhatsApp}
							className="gap-2 bg-green-500 hover:bg-green-600"
							data-testid="button-share-whatsapp"
						>
							<MessageSquare className="h-4 w-4" />
							WhatsApp
						</Button>
					</div>

					{/* Copy to Clipboard */}
					<Button
						onClick={copyToClipboard}
						variant="outline"
						className="w-full gap-2"
						data-testid="button-copy-achievement"
					>
						<Copy className="h-4 w-4" />
						{copySuccess ? "Copied!" : "Copy to Clipboard"}
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}

export default SocialSharing;
