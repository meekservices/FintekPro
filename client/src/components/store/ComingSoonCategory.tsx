import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { Clock, Bell, Send, Loader2, Calendar, Sparkles } from "lucide-react";

interface ComingSoonCategoryProps {
	categoryId: string;
	categoryName: string;
	message?: string;
	expectedDate?: string;
	icon?: string;
}

export function ComingSoonCategory({
	categoryId,
	categoryName,
	message,
	expectedDate,
	icon,
}: ComingSoonCategoryProps) {
	const { user, isAuthenticated } = useAuth();
	const { toast } = useToast();
	const [formData, setFormData] = useState({
		name: user ? [user.firstName, user.lastName].filter(Boolean).join(" ") : "",
		email: user?.email || "",
		phone: user?.mobile || "",
		message: "",
	});

	const submitInquiry = useMutation({
		mutationFn: async () => {
			const response = await apiRequest("POST", "/api/store/inquiries", {
				categoryId,
				name: formData.name,
				email: formData.email,
				phone: formData.phone,
				message: formData.message,
				inquiryType: "availability",
			});
			return response.json();
		},
		onSuccess: () => {
			toast({
				title: "Interest Registered",
				description: "We'll notify you when this category becomes available.",
			});
			setFormData((prev) => ({ ...prev, message: "" }));
		},
		onError: () => {
			toast({
				variant: "destructive",
				title: "Failed to submit",
				description: "Please try again later.",
			});
		},
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!formData.email) {
			toast({ variant: "destructive", title: "Email is required" });
			return;
		}
		submitInquiry.mutate();
	};

	return (
		<Card className="border-dashed border-2 bg-gradient-to-br from-muted/30 to-muted/10">
			<CardHeader className="text-center pb-4">
				<div className="mx-auto mb-4 p-4 rounded-full bg-primary/10">
					<Clock className="h-10 w-10 text-primary" />
				</div>
				<div className="flex items-center justify-center gap-2 mb-2">
					<Badge
						variant="secondary"
						className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
					>
						<Sparkles className="h-3 w-3 mr-1" />
						Coming Soon
					</Badge>
				</div>
				<CardTitle className="text-2xl">{categoryName}</CardTitle>
				<CardDescription className="text-base">
					{message ||
						`We're working hard to bring you ${categoryName}. Register your interest to be notified when it launches.`}
				</CardDescription>
				{expectedDate && (
					<div className="flex items-center justify-center gap-2 mt-3 text-sm text-muted-foreground">
						<Calendar className="h-4 w-4" />
						<span>
							Expected:{" "}
							{new Date(expectedDate).toLocaleDateString("en-IN", {
								month: "long",
								year: "numeric",
							})}
						</span>
					</div>
				)}
			</CardHeader>
			<CardContent>
				<form onSubmit={handleSubmit} className="space-y-4 max-w-md mx-auto">
					<div className="space-y-2">
						<Label htmlFor="inquiry-name">Name</Label>
						<Input
							id="inquiry-name"
							placeholder="Your name"
							value={formData.name}
							onChange={(e) =>
								setFormData((prev) => ({ ...prev, name: e.target.value }))
							}
							data-testid="inquiry-name"
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="inquiry-email">Email *</Label>
						<Input
							id="inquiry-email"
							type="email"
							placeholder="your.email@example.com"
							value={formData.email}
							onChange={(e) =>
								setFormData((prev) => ({ ...prev, email: e.target.value }))
							}
							required
							data-testid="inquiry-email"
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="inquiry-phone">Phone</Label>
						<Input
							id="inquiry-phone"
							type="tel"
							placeholder="+91 XXXXX XXXXX"
							value={formData.phone}
							onChange={(e) =>
								setFormData((prev) => ({ ...prev, phone: e.target.value }))
							}
							data-testid="inquiry-phone"
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="inquiry-message">
							What interests you about {categoryName}?
						</Label>
						<Textarea
							id="inquiry-message"
							placeholder="Tell us about your investment goals..."
							value={formData.message}
							onChange={(e) =>
								setFormData((prev) => ({ ...prev, message: e.target.value }))
							}
							rows={3}
							data-testid="inquiry-message"
						/>
					</div>

					<Button
						type="submit"
						className="w-full"
						disabled={submitInquiry.isPending}
						data-testid="submit-inquiry"
					>
						{submitInquiry.isPending ? (
							<>
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
								Submitting...
							</>
						) : (
							<>
								<Bell className="h-4 w-4 mr-2" />
								Notify Me When Available
							</>
						)}
					</Button>

					<p className="text-xs text-center text-muted-foreground">
						We'll contact you when {categoryName} products become available.
						Your data is safe with us.
					</p>
				</form>
			</CardContent>
		</Card>
	);
}
