import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
	Gift,
	Users,
	Copy,
	Share2,
	Mail,
	Phone,
	CheckCircle,
	Clock,
	IndianRupee,
	Trophy,
	Sparkles,
	ArrowRight,
	QrCode,
} from "lucide-react";
import QRCode from "react-qr-code";

export default function ReferralProgram() {
	const [inviteEmail, setInviteEmail] = useState("");
	const [invitePhone, setInvitePhone] = useState("");
	const { toast } = useToast();

	const { data: codeData } = useQuery<{
		success: boolean;
		referralCode: string;
	}>({
		queryKey: ["/api/features/referral/code"],
	});

	const { data: statsData } = useQuery<{
		success: boolean;
		stats: {
			totalInvites: number;
			registered: number;
			kycComplete: number;
			invested: number;
			totalEarnings: number;
			pendingEarnings: number;
		};
	}>({
		queryKey: ["/api/features/referral/stats"],
	});

	const inviteMutation = useMutation({
		mutationFn: async (data: { email: string; phone?: string }) => {
			return apiRequest("/api/features/referral/invite", {
				method: "POST",
				body: JSON.stringify(data),
			});
		},
		onSuccess: () => {
			toast({
				title: "Invitation Sent",
				description: "Your referral invitation has been sent successfully.",
			});
			setInviteEmail("");
			setInvitePhone("");
			queryClient.invalidateQueries({
				queryKey: ["/api/features/referral/stats"],
			});
		},
		onError: () => {
			toast({
				title: "Failed to Send",
				description: "Could not send the invitation. Please try again.",
				variant: "destructive",
			});
		},
	});

	const referralCode = codeData?.referralCode || "LOADING...";
	const referralLink = `${window.location.origin}/register?ref=${referralCode}`;
	const stats = statsData?.stats;

	const copyToClipboard = (text: string) => {
		navigator.clipboard.writeText(text);
		toast({
			title: "Copied!",
			description: "Referral link copied to clipboard.",
		});
	};

	const shareVia = (platform: string) => {
		const message = `Join FintekPro and start your investment journey! Use my referral code ${referralCode} to get started. ${referralLink}`;

		switch (platform) {
			case "whatsapp":
				window.open(
					`https://wa.me/?text=${encodeURIComponent(message)}`,
					"_blank",
				);
				break;
			case "email":
				window.open(
					`mailto:?subject=Join FintekPro&body=${encodeURIComponent(message)}`,
					"_blank",
				);
				break;
			case "twitter":
				window.open(
					`https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}`,
					"_blank",
				);
				break;
		}
	};

	const handleInvite = () => {
		if (!inviteEmail) {
			toast({
				title: "Email Required",
				description: "Please enter an email address.",
				variant: "destructive",
			});
			return;
		}
		inviteMutation.mutate({
			email: inviteEmail,
			phone: invitePhone || undefined,
		});
	};

	return (
		<div className="container max-w-6xl mx-auto py-8 px-4">
			<div className="mb-8">
				<h1 className="text-3xl font-bold flex items-center gap-3">
					<Gift className="h-8 w-8 text-primary" />
					Referral Program
				</h1>
				<p className="text-muted-foreground mt-2">
					Invite friends and earn rewards when they start investing
				</p>
			</div>

			<div className="grid md:grid-cols-3 gap-6 mb-8">
				<Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
					<CardContent className="pt-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">Total Earnings</p>
								<p className="text-3xl font-bold text-primary">
									₹{stats?.totalEarnings?.toLocaleString("en-IN") || "0"}
								</p>
							</div>
							<Trophy className="h-12 w-12 text-primary/30" />
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="pt-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">Pending Rewards</p>
								<p className="text-3xl font-bold">
									₹{stats?.pendingEarnings?.toLocaleString("en-IN") || "0"}
								</p>
							</div>
							<Clock className="h-12 w-12 text-muted-foreground/30" />
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardContent className="pt-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-sm text-muted-foreground">
									Friends Invested
								</p>
								<p className="text-3xl font-bold">{stats?.invested || 0}</p>
							</div>
							<Users className="h-12 w-12 text-muted-foreground/30" />
						</div>
					</CardContent>
				</Card>
			</div>

			<div className="grid md:grid-cols-2 gap-6 mb-8">
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Share2 className="h-5 w-5" />
							Your Referral Code
						</CardTitle>
						<CardDescription>
							Share this code with friends to earn rewards
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="flex items-center gap-2">
							<div className="flex-1 bg-muted rounded-lg p-4 text-center">
								<span
									className="text-2xl font-mono font-bold tracking-wider"
									data-testid="referral-code"
								>
									{referralCode}
								</span>
							</div>
							<Button
								variant="outline"
								size="icon"
								onClick={() => copyToClipboard(referralCode)}
								data-testid="copy-code"
							>
								<Copy className="h-4 w-4" />
							</Button>
						</div>

						<div className="flex items-center gap-2">
							<Input value={referralLink} readOnly className="text-sm" />
							<Button
								variant="outline"
								size="icon"
								onClick={() => copyToClipboard(referralLink)}
								data-testid="copy-link"
							>
								<Copy className="h-4 w-4" />
							</Button>
						</div>

						<div className="flex gap-2">
							<Button
								variant="outline"
								className="flex-1"
								onClick={() => shareVia("whatsapp")}
								data-testid="share-whatsapp"
							>
								<Share2 className="h-4 w-4 mr-2" />
								WhatsApp
							</Button>
							<Button
								variant="outline"
								className="flex-1"
								onClick={() => shareVia("email")}
								data-testid="share-email"
							>
								<Mail className="h-4 w-4 mr-2" />
								Email
							</Button>
						</div>

						<div className="flex justify-center pt-4">
							<div className="bg-card p-4 rounded-lg">
								<QRCode value={referralLink} size={120} />
							</div>
						</div>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Mail className="h-5 w-5" />
							Send Invitation
						</CardTitle>
						<CardDescription>Invite friends directly via email</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div>
							<label className="text-sm font-medium">Email Address</label>
							<Input
								type="email"
								placeholder="friend@example.com"
								value={inviteEmail}
								onChange={(e) => setInviteEmail(e.target.value)}
								data-testid="invite-email"
							/>
						</div>
						<div>
							<label className="text-sm font-medium">Phone (Optional)</label>
							<Input
								type="tel"
								placeholder="+91 9876543210"
								value={invitePhone}
								onChange={(e) => setInvitePhone(e.target.value)}
								data-testid="invite-phone"
							/>
						</div>
						<Button
							className="w-full"
							onClick={handleInvite}
							disabled={inviteMutation.isPending}
							data-testid="send-invite"
						>
							{inviteMutation.isPending ? "Sending..." : "Send Invitation"}
							<ArrowRight className="h-4 w-4 ml-2" />
						</Button>
					</CardContent>
				</Card>
			</div>

			<Card className="mb-8">
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Sparkles className="h-5 w-5" />
						How It Works
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="grid md:grid-cols-4 gap-6">
						{[
							{
								step: 1,
								title: "Share Code",
								desc: "Share your unique referral code with friends",
								icon: Share2,
							},
							{
								step: 2,
								title: "Friend Registers",
								desc: "They sign up using your referral code",
								icon: Users,
							},
							{
								step: 3,
								title: "Complete KYC",
								desc: "Your friend completes their KYC verification",
								icon: CheckCircle,
							},
							{
								step: 4,
								title: "Earn Rewards",
								desc: "Both of you earn rewards when they invest",
								icon: Gift,
							},
						].map(({ step, title, desc, icon: Icon }) => (
							<div key={step} className="text-center">
								<div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
									<Icon className="h-6 w-6 text-primary" />
								</div>
								<Badge variant="outline" className="mb-2">
									Step {step}
								</Badge>
								<h3 className="font-semibold mb-1">{title}</h3>
								<p className="text-sm text-muted-foreground">{desc}</p>
							</div>
						))}
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Referral Progress</CardTitle>
					<CardDescription>Track your referral journey</CardDescription>
				</CardHeader>
				<CardContent>
					<div className="space-y-4">
						<div className="flex items-center justify-between">
							<div className="flex items-center gap-3">
								<div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
									<Mail className="h-5 w-5 text-blue-600" />
								</div>
								<div>
									<p className="font-medium">Invitations Sent</p>
									<p className="text-sm text-muted-foreground">
										{stats?.totalInvites || 0} friends invited
									</p>
								</div>
							</div>
							<Badge variant="secondary">{stats?.totalInvites || 0}</Badge>
						</div>

						<div className="flex items-center justify-between">
							<div className="flex items-center gap-3">
								<div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
									<Users className="h-5 w-5 text-green-600" />
								</div>
								<div>
									<p className="font-medium">Registered</p>
									<p className="text-sm text-muted-foreground">
										{stats?.registered || 0} friends signed up
									</p>
								</div>
							</div>
							<Badge variant="secondary">{stats?.registered || 0}</Badge>
						</div>

						<div className="flex items-center justify-between">
							<div className="flex items-center gap-3">
								<div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
									<CheckCircle className="h-5 w-5 text-purple-600" />
								</div>
								<div>
									<p className="font-medium">KYC Complete</p>
									<p className="text-sm text-muted-foreground">
										{stats?.kycComplete || 0} verified accounts
									</p>
								</div>
							</div>
							<Badge variant="secondary">{stats?.kycComplete || 0}</Badge>
						</div>

						<div className="flex items-center justify-between">
							<div className="flex items-center gap-3">
								<div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
									<IndianRupee className="h-5 w-5 text-orange-600" />
								</div>
								<div>
									<p className="font-medium">First Investment</p>
									<p className="text-sm text-muted-foreground">
										{stats?.invested || 0} started investing
									</p>
								</div>
							</div>
							<Badge variant="secondary">{stats?.invested || 0}</Badge>
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
