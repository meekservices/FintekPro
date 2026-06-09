import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, Send, CheckCircle, IndianRupee } from "lucide-react";

const expressInterestSchema = z.object({
	name: z.string().min(2, "Name must be at least 2 characters"),
	email: z.string().email("Please enter a valid email address"),
	phone: z.string().optional(),
	investmentAmount: z.string().optional(),
	investmentTimeline: z.string().optional(),
	message: z.string().optional(),
});

type ExpressInterestFormData = z.infer<typeof expressInterestSchema>;

interface ExpressInterestDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	productType: "aif" | "pms" | "mld";
	productId: string;
	productName: string;
	minInvestment?: string | number | null;
}

const INVESTMENT_TIMELINES = [
	{ value: "immediate", label: "Ready to invest immediately" },
	{ value: "within_1_month", label: "Within 1 month" },
	{ value: "within_3_months", label: "Within 3 months" },
	{ value: "exploring", label: "Just exploring options" },
];

const formatCurrency = (value: string | number | null | undefined) => {
	if (!value) return "";
	const num = typeof value === "string" ? Number.parseFloat(value) : value;
	if (Number.isNaN(num)) return "";
	if (num >= 10000000) return `₹${(num / 10000000).toFixed(0)} Crore`;
	if (num >= 100000) return `₹${(num / 100000).toFixed(0)} Lakhs`;
	return `₹${num.toLocaleString("en-IN")}`;
};

export function ExpressInterestDialog({
	open,
	onOpenChange,
	productType,
	productId,
	productName,
	minInvestment,
}: ExpressInterestDialogProps) {
	const { toast } = useToast();
	const [submitted, setSubmitted] = useState(false);

	const form = useForm<ExpressInterestFormData>({
		resolver: zodResolver(expressInterestSchema),
		defaultValues: {
			name: "",
			email: "",
			phone: "",
			investmentAmount: "",
			investmentTimeline: "",
			message: "",
		},
	});

	const mutation = useMutation({
		mutationFn: async (data: ExpressInterestFormData) => {
			const endpoint = `/api/store/${productType}/${productId}/express-interest`;
			const response = await apiRequest("POST", endpoint, data);
			return response.json();
		},
		onSuccess: (data) => {
			setSubmitted(true);
			toast({
				title: "Interest Submitted",
				description: data.message || "Our team will contact you shortly.",
			});
		},
		onError: (error: any) => {
			toast({
				title: "Submission Failed",
				description: error.message || "Please try again later.",
				variant: "destructive",
			});
		},
	});

	const onSubmit = (data: ExpressInterestFormData) => {
		mutation.mutate(data);
	};

	const handleClose = () => {
		if (submitted) {
			setSubmitted(false);
			form.reset();
		}
		onOpenChange(false);
	};

	const productTypeLabels = {
		aif: "Alternative Investment Fund",
		pms: "Portfolio Management Service",
		mld: "Market Linked Debenture",
	};

	return (
		<Dialog open={open} onOpenChange={handleClose}>
			<DialogContent
				className="sm:max-w-[500px]"
				data-testid="express-interest-dialog"
			>
				{submitted ? (
					<div className="py-8 text-center" data-testid="success-message">
						<div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
							<CheckCircle className="h-8 w-8 text-green-600" />
						</div>
						<DialogTitle className="text-2xl">Thank You!</DialogTitle>
						<DialogDescription className="mt-2 text-base">
							We have received your interest in <strong>{productName}</strong>.
							Our investment advisor will contact you within 24 hours.
						</DialogDescription>
						<Button
							onClick={handleClose}
							className="mt-6"
							data-testid="btn-close-success"
						>
							Close
						</Button>
					</div>
				) : (
					<>
						<DialogHeader>
							<DialogTitle className="text-xl">Express Interest</DialogTitle>
							<DialogDescription>
								{productTypeLabels[productType]}: <strong>{productName}</strong>
								{minInvestment && (
									<span className="block mt-1 text-sm">
										<IndianRupee className="inline h-3 w-3" /> Minimum
										Investment: {formatCurrency(minInvestment)}
									</span>
								)}
							</DialogDescription>
						</DialogHeader>

						<Form {...form}>
							<form
								onSubmit={form.handleSubmit(onSubmit)}
								className="space-y-4"
							>
								<FormField
									control={form.control}
									name="name"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Full Name *</FormLabel>
											<FormControl>
												<Input
													placeholder="Your full name"
													{...field}
													data-testid="input-name"
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="email"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Email Address *</FormLabel>
											<FormControl>
												<Input
													type="email"
													placeholder="your@email.com"
													{...field}
													data-testid="input-email"
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="phone"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Phone Number</FormLabel>
											<FormControl>
												<Input
													type="tel"
													placeholder="+91 98765 43210"
													{...field}
													data-testid="input-phone"
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="investmentAmount"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Intended Investment Amount</FormLabel>
											<FormControl>
												<Input
													placeholder="e.g., 1 Crore"
													{...field}
													data-testid="input-amount"
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="investmentTimeline"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Investment Timeline</FormLabel>
											<Select
												onValueChange={field.onChange}
												defaultValue={field.value}
											>
												<FormControl>
													<SelectTrigger data-testid="select-timeline">
														<SelectValue placeholder="When are you looking to invest?" />
													</SelectTrigger>
												</FormControl>
												<SelectContent>
													{INVESTMENT_TIMELINES.map((timeline) => (
														<SelectItem
															key={timeline.value}
															value={timeline.value}
														>
															{timeline.label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
											<FormMessage />
										</FormItem>
									)}
								/>

								<FormField
									control={form.control}
									name="message"
									render={({ field }) => (
										<FormItem>
											<FormLabel>Additional Message</FormLabel>
											<FormControl>
												<Textarea
													placeholder="Any specific questions or requirements..."
													className="resize-none"
													{...field}
													data-testid="input-message"
												/>
											</FormControl>
											<FormMessage />
										</FormItem>
									)}
								/>

								<DialogFooter className="pt-4">
									<Button
										type="button"
										variant="outline"
										onClick={handleClose}
										data-testid="btn-cancel"
									>
										Cancel
									</Button>
									<Button
										type="submit"
										disabled={mutation.isPending}
										data-testid="btn-submit"
									>
										{mutation.isPending ? (
											<>
												<Loader2 className="mr-2 h-4 w-4 animate-spin" />
												Submitting...
											</>
										) : (
											<>
												<Send className="mr-2 h-4 w-4" />
												Submit Interest
											</>
										)}
									</Button>
								</DialogFooter>
							</form>
						</Form>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}

export function ExpressInterestButton({
	productType,
	productId,
	productName,
	minInvestment,
	variant = "default",
	size = "default",
	className = "",
}: Omit<ExpressInterestDialogProps, "open" | "onOpenChange"> & {
	variant?: "default" | "outline" | "secondary" | "ghost";
	size?: "default" | "sm" | "lg" | "icon";
	className?: string;
}) {
	const [open, setOpen] = useState(false);

	return (
		<>
			<Button
				variant={variant}
				size={size}
				className={className}
				onClick={(e) => {
					e.stopPropagation();
					setOpen(true);
				}}
				data-testid={`btn-express-interest-${productId}`}
			>
				Express Interest
			</Button>
			<ExpressInterestDialog
				open={open}
				onOpenChange={setOpen}
				productType={productType}
				productId={productId}
				productName={productName}
				minInvestment={minInvestment}
			/>
		</>
	);
}
