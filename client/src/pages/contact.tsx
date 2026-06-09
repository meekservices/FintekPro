import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
	Mail,
	MapPin,
	Clock,
	Building,
	Send,
	MessageSquare,
	HeadphonesIcon,
} from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { useMutation } from "@tanstack/react-query";

const contactSchema = z.object({
	fullName: z.string().min(1, "Full name is required"),
	email: z.string().email("Valid email is required"),
	phone: z.string().min(10, "Valid phone number is required"),
	company: z.string().optional(),
	inquiryType: z.string().min(1, "Please select inquiry type"),
	subject: z.string().min(1, "Subject is required"),
	message: z.string().min(10, "Message must be at least 10 characters"),
});

type ContactFormData = z.infer<typeof contactSchema>;

export default function Contact() {
	const { toast } = useToast();

	const form = useForm<ContactFormData>({
		resolver: zodResolver(contactSchema),
		defaultValues: {
			fullName: "",
			email: "",
			phone: "",
			company: "",
			inquiryType: "",
			subject: "",
			message: "",
		},
	});

	const submitContactMutation = useMutation({
		mutationFn: async (data: ContactFormData) => {
			const response = await fetch("/api/contact/submit", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(data),
			});

			if (!response.ok) {
				throw new Error("Failed to submit contact form");
			}

			return response.json();
		},
		onSuccess: () => {
			toast({
				title: "Message sent successfully!",
				description: "We'll get back to you within 24 hours.",
			});
			form.reset();
		},
		onError: (error) => {
			toast({
				title: "Failed to send message",
				description: "Please try again or contact us directly.",
				variant: "destructive",
			});
		},
	});

	const onSubmit = (data: ContactFormData) => {
		submitContactMutation.mutate(data);
	};

	const officeLocations = [
		{
			city: "Mumbai",
			address: "FintekPro Tower, Bandra Kurla Complex, Mumbai - 400051",
			email: "mumbai@fintekpro.com",
		},
		{
			city: "Delhi",
			address: "FintekPro Plaza, Connaught Place, New Delhi - 110001",
			email: "delhi@fintekpro.com",
		},
		{
			city: "Bangalore",
			address: "FintekPro Campus, Electronic City Phase 1, Bangalore - 560100",
			email: "bangalore@fintekpro.com",
		},
	];

	const contactMethods = [
		{
			title: "Sales Inquiries",
			description: "New investment opportunities and portfolio services",
			icon: Building,
			contact: "sales@fintekpro.com",
			whatsapp: "9686854321",
		},
		{
			title: "Customer Support",
			description: "Account assistance and technical support",
			icon: HeadphonesIcon,
			contact: "support@fintekpro.com",
			whatsapp: "9686854321",
		},
		{
			title: "Partnership",
			description: "Business partnerships and institutional services",
			icon: MessageSquare,
			contact: "partners@fintekpro.com",
			whatsapp: "9686854321",
		},
	];

	return (
		<div className="space-y-8">
			{/* Hero Section */}
			<div className="bg-card py-16">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
					<h1
						className="text-4xl font-bold text-foreground mb-4"
						data-testid="contact-title"
					>
						Contact FintekPro
					</h1>
					<p className="text-xl text-muted-foreground max-w-3xl mx-auto">
						Ready to accelerate your wealth journey? Our financial experts are
						here to help you transform your investment potential into real
						returns.
					</p>
				</div>
			</div>

			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
					{/* Contact Form */}
					<Card className="h-fit">
						<CardHeader>
							<CardTitle
								className="flex items-center gap-2"
								data-testid="contact-form-title"
							>
								<Send className="h-5 w-5 text-finance-blue" />
								Send us a Message
							</CardTitle>
							<CardDescription>
								Fill out the form below and we'll get back to you within 24
								hours.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<Form {...form}>
								<form
									onSubmit={form.handleSubmit(onSubmit)}
									className="space-y-6"
								>
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
										<FormField
											control={form.control}
											name="fullName"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Full Name *</FormLabel>
													<FormControl>
														<Input
															placeholder="Enter your full name"
															{...field}
															data-testid="input-fullname"
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
															placeholder="your.email@example.com"
															{...field}
															data-testid="input-email"
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
									</div>

									<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
										<FormField
											control={form.control}
											name="phone"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Phone Number *</FormLabel>
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
											name="company"
											render={({ field }) => (
												<FormItem>
													<FormLabel>Company (Optional)</FormLabel>
													<FormControl>
														<Input
															placeholder="Company name"
															{...field}
															data-testid="input-company"
														/>
													</FormControl>
													<FormMessage />
												</FormItem>
											)}
										/>
									</div>

									<FormField
										control={form.control}
										name="inquiryType"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Inquiry Type *</FormLabel>
												<Select
													onValueChange={field.onChange}
													defaultValue={field.value}
												>
													<FormControl>
														<SelectTrigger data-testid="select-inquiry-type">
															<SelectValue placeholder="Select inquiry type" />
														</SelectTrigger>
													</FormControl>
													<SelectContent>
														<SelectItem value="investment">
															Investment Services
														</SelectItem>
														<SelectItem value="investsmart">
															InvestSmart
														</SelectItem>
														<SelectItem value="loan-services">
															Loan Services
														</SelectItem>
														<SelectItem value="insurance">
															Insurance Products
														</SelectItem>
														<SelectItem value="trading">
															Trading & Demat
														</SelectItem>
														<SelectItem value="partnership">
															Partnership Opportunities
														</SelectItem>
														<SelectItem value="technical-support">
															Technical Support
														</SelectItem>
														<SelectItem value="other">Other</SelectItem>
													</SelectContent>
												</Select>
												<FormMessage />
											</FormItem>
										)}
									/>

									<FormField
										control={form.control}
										name="subject"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Subject *</FormLabel>
												<FormControl>
													<Input
														placeholder="Brief subject of your inquiry"
														{...field}
														data-testid="input-subject"
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>

									<FormField
										control={form.control}
										name="message"
										render={({ field }) => (
											<FormItem>
												<FormLabel>Message *</FormLabel>
												<FormControl>
													<Textarea
														placeholder="Describe your inquiry or requirement in detail..."
														className="min-h-[120px]"
														{...field}
														data-testid="textarea-message"
													/>
												</FormControl>
												<FormMessage />
											</FormItem>
										)}
									/>

									<Button
										type="submit"
										className="w-full"
										disabled={submitContactMutation.isPending}
										data-testid="button-submit-contact"
									>
										{submitContactMutation.isPending ? (
											<>Sending...</>
										) : (
											<>
												<Send className="h-4 w-4 mr-2" />
												Send Message
											</>
										)}
									</Button>
								</form>
							</Form>
						</CardContent>
					</Card>

					{/* Contact Information */}
					<div className="space-y-8">
						{/* Contact Methods */}
						<Card>
							<CardHeader>
								<CardTitle data-testid="contact-methods-title">
									Get in Touch
								</CardTitle>
								<CardDescription>
									Choose the best way to reach us based on your needs.
								</CardDescription>
							</CardHeader>
							<CardContent className="space-y-6">
								{contactMethods.map((method, index) => (
									<div
										key={index}
										className="flex items-start gap-4 p-4 border rounded-lg"
										data-testid={`contact-method-${index}`}
									>
										<div className="mt-1">
											<method.icon className="h-5 w-5 text-finance-blue" />
										</div>
										<div className="flex-1">
											<h3 className="font-semibold text-foreground">
												{method.title}
											</h3>
											<p className="text-sm text-muted-foreground mb-2">
												{method.description}
											</p>
											<div className="space-y-1">
												<p className="text-sm">
													<Mail className="h-4 w-4 inline mr-1" />
													{method.contact}
												</p>
												<p className="text-sm">
													<SiWhatsapp className="h-4 w-4 inline mr-1 text-green-500" />
													{method.whatsapp}
												</p>
											</div>
										</div>
									</div>
								))}
							</CardContent>
						</Card>

						{/* Business Hours */}
						<Card>
							<CardHeader>
								<CardTitle
									className="flex items-center gap-2"
									data-testid="business-hours-title"
								>
									<Clock className="h-5 w-5 text-finance-blue" />
									Business Hours
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="space-y-3">
									<div className="flex justify-between items-center py-2 border-b">
										<span className="font-medium">Monday - Friday</span>
										<span className="text-muted-foreground">
											9:00 AM - 6:00 PM
										</span>
									</div>
									<div className="flex justify-between items-center py-2 border-b">
										<span className="font-medium">Saturday</span>
										<span className="text-muted-foreground">
											10:00 AM - 2:00 PM
										</span>
									</div>
									<div className="flex justify-between items-center py-2">
										<span className="font-medium">Sunday</span>
										<span className="text-muted-foreground">Closed</span>
									</div>
									<div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
										<p className="text-sm text-blue-700 dark:text-blue-300">
											<strong>24/7 Emergency Trading Support</strong> available
											for urgent portfolio matters.
										</p>
									</div>
								</div>
							</CardContent>
						</Card>
					</div>
				</div>

				{/* Office Locations */}
				<div className="mt-16">
					<div className="text-center mb-12">
						<h2
							className="text-3xl font-bold text-foreground mb-4"
							data-testid="office-locations-title"
						>
							Our Office Locations
						</h2>
						<p className="text-lg text-muted-foreground">
							Visit us at any of our offices across India for personalized
							financial consultations.
						</p>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-8">
						{officeLocations.map((office, index) => (
							<Card
								key={index}
								className="hover:shadow-lg transition-shadow"
								data-testid={`office-${office.city.toLowerCase()}`}
							>
								<CardHeader>
									<CardTitle className="flex items-center gap-2">
										<MapPin className="h-5 w-5 text-finance-blue" />
										{office.city} Office
									</CardTitle>
								</CardHeader>
								<CardContent className="space-y-4">
									<p className="text-sm text-muted-foreground">
										{office.address}
									</p>
									<div className="space-y-2">
										<p className="text-sm flex items-center gap-2">
											<Mail className="h-4 w-4 text-finance-blue" />
											{office.email}
										</p>
									</div>
									<Button
										variant="outline"
										className="w-full"
										data-testid={`button-directions-${office.city.toLowerCase()}`}
									>
										Get Directions
									</Button>
								</CardContent>
							</Card>
						))}
					</div>
				</div>

				{/* Quick Response Section */}
				<div className="mt-16 bg-gradient-to-r from-finance-blue to-blue-600 rounded-2xl text-foreground p-8">
					<div className="text-center">
						<h2
							className="text-3xl font-bold mb-4"
							data-testid="quick-response-title"
						>
							Need Immediate Assistance?
						</h2>
						<p className="text-xl mb-8 text-blue-100">
							Our investment experts are ready to help you start building wealth
							today.
						</p>
						<div className="flex flex-col sm:flex-row gap-4 justify-center">
							<Button
								size="lg"
								variant="secondary"
								className="bg-card text-finance-blue hover:bg-muted"
								data-testid="button-whatsapp-now"
							>
								<SiWhatsapp className="h-5 w-5 mr-2" />
								WhatsApp Now: 9686854321
							</Button>
							<Button
								size="lg"
								variant="outline"
								className="border-white text-foreground hover:bg-card hover:text-finance-blue"
								data-testid="button-schedule-callback"
							>
								<Clock className="h-5 w-5 mr-2" />
								Schedule Callback
							</Button>
						</div>
					</div>
				</div>

				{/* FAQ Section */}
				<div className="mt-16">
					<div className="text-center mb-12">
						<h2
							className="text-3xl font-bold text-foreground mb-4"
							data-testid="faq-title"
						>
							Frequently Asked Questions
						</h2>
						<p className="text-lg text-muted-foreground">
							Quick answers to common questions about our services.
						</p>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
						<Card>
							<CardHeader>
								<CardTitle className="text-lg">
									How do I open an investment account?
								</CardTitle>
							</CardHeader>
							<CardContent>
								<p className="text-muted-foreground">
									You can start investing in just 10 minutes with our digital
									onboarding process. Simply complete your CKYC verification and
									fund your account.
								</p>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle className="text-lg">
									What's the minimum investment amount?
								</CardTitle>
							</CardHeader>
							<CardContent>
								<p className="text-muted-foreground">
									Our minimum investment starts from ₹500 for mutual funds and
									₹5,000 for direct equity investments, making wealth building
									accessible to everyone.
								</p>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle className="text-lg">
									Are my investments safe with FintekPro?
								</CardTitle>
							</CardHeader>
							<CardContent>
								<p className="text-muted-foreground">
									Yes, we're SEBI registered and use bank-grade security. Your
									investments are held with custodians and protected by investor
									insurance.
								</p>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle className="text-lg">
									How quickly can I access my money?
								</CardTitle>
							</CardHeader>
							<CardContent>
								<p className="text-muted-foreground">
									Liquid funds and equity withdrawals are processed within T+1
									days. Emergency withdrawals are available for certain
									investment products.
								</p>
							</CardContent>
						</Card>
					</div>
				</div>
			</div>
		</div>
	);
}
