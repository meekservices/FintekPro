import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import {
	RefreshCcw,
	CreditCard,
	XCircle,
	CheckCircle,
	Clock,
	AlertTriangle,
	HelpCircle,
	Phone,
	Ban,
} from "lucide-react";

export default function RefundPolicy() {
	const [isNavCollapsed, setIsNavCollapsed] = useState(() => {
		const saved = localStorage.getItem("nav-collapsed");
		return saved ? JSON.parse(saved) : false;
	});

	useEffect(() => {
		document.title = "Refund & Cancellation Policy - FintekPro";

		const handleNavChange = (e: CustomEvent) => {
			setIsNavCollapsed(e.detail.collapsed);
		};

		window.addEventListener(
			"navigation-change",
			handleNavChange as EventListener,
		);
		return () => {
			window.removeEventListener(
				"navigation-change",
				handleNavChange as EventListener,
			);
		};
	}, []);

	return (
		<div className="min-h-screen bg-gradient-to-br from-blue-50/30 to-indigo-100/30 dark:from-background dark:to-card">
			<main className="py-12 px-4">
				<div className="max-w-4xl mx-auto">
					<div className="text-center mb-12">
						<div className="flex items-center justify-center mb-4">
							<RefreshCcw className="w-12 h-12 text-blue-600 mr-3" />
							<h1 className="text-4xl font-bold text-foreground">
								Refund & Cancellation Policy
							</h1>
						</div>
						<p className="text-lg text-muted-foreground">
							Transparent refund and cancellation terms for FintekPro services.
						</p>
						<p className="text-sm text-muted-foreground mt-2">
							Last updated: January 3, 2026
						</p>
					</div>

					<div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800 mb-8">
						<h4 className="font-semibold text-amber-800 dark:text-amber-200 mb-2">
							Important Notice
						</h4>
						<p className="text-amber-700 dark:text-amber-300 text-sm">
							FintekPro is a financial services platform. Unlike physical goods,
							financial transactions and advisory services have specific refund
							considerations based on regulatory requirements and the nature of
							services provided.
						</p>
					</div>

					<div className="space-y-8">
						<Card>
							<CardHeader>
								<CardTitle className="flex items-center">
									<CheckCircle className="w-5 h-5 mr-2 text-green-600" />
									Refundable Items
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div>
									<h4 className="font-semibold mb-2">
										Platform Subscription Fees
									</h4>
									<ul className="list-disc list-inside text-muted-foreground space-y-1">
										<li>
											Full refund within 7 days of purchase if no premium
											features used
										</li>
										<li>
											Pro-rata refund for annual subscriptions cancelled within
											30 days
										</li>
										<li>No refund after 30 days of subscription activation</li>
									</ul>
								</div>
								<div>
									<h4 className="font-semibold mb-2">Failed Transactions</h4>
									<ul className="list-disc list-inside text-muted-foreground space-y-1">
										<li>
											Full refund for payment gateway failures where amount
											debited but order not processed
										</li>
										<li>
											Automatic reversal within 5-7 business days to source
											account
										</li>
										<li>
											Manual refund request if auto-reversal not received within
											10 business days
										</li>
									</ul>
								</div>
								<div>
									<h4 className="font-semibold mb-2">Duplicate Payments</h4>
									<ul className="list-disc list-inside text-muted-foreground space-y-1">
										<li>Full refund for verified duplicate charges</li>
										<li>
											Processing time: 7-10 business days after verification
										</li>
									</ul>
								</div>
								<div>
									<h4 className="font-semibold mb-2">Service Not Rendered</h4>
									<ul className="list-disc list-inside text-muted-foreground space-y-1">
										<li>
											Full refund if paid service was not delivered due to our
											fault
										</li>
										<li>
											Partial refund for partially completed services (pro-rata
											basis)
										</li>
									</ul>
								</div>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle className="flex items-center">
									<Ban className="w-5 h-5 mr-2 text-red-600" />
									Non-Refundable Items
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800 mb-4">
									<p className="text-red-700 dark:text-red-300 text-sm">
										The following charges are non-refundable as they represent
										services already rendered or regulatory costs incurred.
									</p>
								</div>
								<div>
									<h4 className="font-semibold mb-2">
										Investment Transactions
									</h4>
									<ul className="list-disc list-inside text-muted-foreground space-y-1">
										<li>
											Mutual fund investments once units are allotted (use
											redemption to exit)
										</li>
										<li>
											Stock purchases once trades are executed on exchanges
										</li>
										<li>Bond purchases once settlement is complete</li>
										<li>IPO applications once submitted to registrar</li>
										<li>Unlisted share purchases once deal is confirmed</li>
									</ul>
								</div>
								<div>
									<h4 className="font-semibold mb-2">Third-Party Charges</h4>
									<ul className="list-disc list-inside text-muted-foreground space-y-1">
										<li>Exchange transaction charges (STT, GST, stamp duty)</li>
										<li>Brokerage fees charged by execution partners</li>
										<li>AMC expense ratios embedded in NAV</li>
										<li>Payment gateway convenience fees</li>
										<li>Government filing fees (ITR, Form 15CA/CB)</li>
									</ul>
								</div>
								<div>
									<h4 className="font-semibold mb-2">
										Advisory & Compliance Services
									</h4>
									<ul className="list-disc list-inside text-muted-foreground space-y-1">
										<li>
											ITR filing charges once return is submitted to Income Tax
											portal
										</li>
										<li>CA consultation fees once consultation is completed</li>
										<li>
											KYC verification charges once verification is processed
										</li>
										<li>eSign/DSC charges once document is signed</li>
										<li>Credit report fetch charges</li>
									</ul>
								</div>
								<div>
									<h4 className="font-semibold mb-2">PMS & AIF Investments</h4>
									<ul className="list-disc list-inside text-muted-foreground space-y-1">
										<li>Management fees once deducted as per agreement</li>
										<li>Performance fees once charged</li>
										<li>Exit loads as per scheme terms</li>
										<li>Commitment fees for AIF subscriptions</li>
									</ul>
								</div>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle className="flex items-center">
									<XCircle className="w-5 h-5 mr-2 text-orange-600" />
									Cancellation Policy
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div>
									<h4 className="font-semibold mb-2">SIP Cancellations</h4>
									<ul className="list-disc list-inside text-muted-foreground space-y-1">
										<li>SIP can be cancelled anytime without penalty</li>
										<li>
											Cancellation request must be placed 5 business days before
											next installment
										</li>
										<li>
											Already invested amounts cannot be refunded (use
											redemption)
										</li>
										<li>
											ELSS SIPs: Units subject to 3-year lock-in from each
											investment date
										</li>
									</ul>
								</div>
								<div>
									<h4 className="font-semibold mb-2">
										Subscription Cancellations
									</h4>
									<ul className="list-disc list-inside text-muted-foreground space-y-1">
										<li>
											Monthly subscriptions: Cancel anytime, no pro-rata refund
										</li>
										<li>
											Annual subscriptions: Pro-rata refund if cancelled within
											30 days
										</li>
										<li>
											Access continues until end of current billing period
										</li>
									</ul>
								</div>
								<div>
									<h4 className="font-semibold mb-2">Order Cancellations</h4>
									<ul className="list-disc list-inside text-muted-foreground space-y-1">
										<li>
											Mutual fund orders: Can be cancelled before cut-off time
											(1:30 PM for equity, 3:00 PM for liquid)
										</li>
										<li>
											Stock orders: Can be cancelled before execution on
											exchange
										</li>
										<li>
											IPO applications: Can be cancelled before bid closure
										</li>
										<li>
											Unlisted orders: Cancellation subject to deal status
											(contact support)
										</li>
									</ul>
								</div>
								<div>
									<h4 className="font-semibold mb-2">
										ITR Filing Cancellations
									</h4>
									<ul className="list-disc list-inside text-muted-foreground space-y-1">
										<li>
											Full refund if cancelled before CA assignment/work
											commencement
										</li>
										<li>
											50% refund if cancelled after work started but before
											filing
										</li>
										<li>
											No refund once ITR is submitted to Income Tax portal
										</li>
									</ul>
								</div>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle className="flex items-center">
									<Clock className="w-5 h-5 mr-2 text-blue-600" />
									Refund Processing Timeline
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="overflow-x-auto">
									<table className="w-full text-sm">
										<thead>
											<tr className="border-b">
												<th className="text-left py-2 font-semibold">
													Payment Method
												</th>
												<th className="text-left py-2 font-semibold">
													Processing Time
												</th>
											</tr>
										</thead>
										<tbody className="text-muted-foreground">
											<tr className="border-b">
												<td className="py-2">UPI</td>
												<td className="py-2">3-5 business days</td>
											</tr>
											<tr className="border-b">
												<td className="py-2">Debit Card</td>
												<td className="py-2">5-7 business days</td>
											</tr>
											<tr className="border-b">
												<td className="py-2">Credit Card</td>
												<td className="py-2">7-10 business days</td>
											</tr>
											<tr className="border-b">
												<td className="py-2">Net Banking</td>
												<td className="py-2">5-7 business days</td>
											</tr>
											<tr className="border-b">
												<td className="py-2">NEFT/RTGS</td>
												<td className="py-2">3-5 business days</td>
											</tr>
											<tr>
												<td className="py-2">Wallet</td>
												<td className="py-2">Instant to 24 hours</td>
											</tr>
										</tbody>
									</table>
								</div>
								<p className="text-sm text-muted-foreground mt-4">
									All refunds are processed to the original payment source.
									Exceptions may apply for closed bank accounts or expired cards
									(alternate payment method required).
								</p>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle className="flex items-center">
									<CreditCard className="w-5 h-5 mr-2 text-blue-600" />
									Exit Loads & Redemption Charges
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div>
									<h4 className="font-semibold mb-2">Mutual Fund Exit Loads</h4>
									<p className="text-muted-foreground mb-2">
										Exit loads are charged by AMCs (not FintekPro) and vary by
										scheme:
									</p>
									<ul className="list-disc list-inside text-muted-foreground space-y-1">
										<li>
											Equity funds: Typically 1% if redeemed within 1 year
										</li>
										<li>Liquid/overnight funds: Usually nil</li>
										<li>ELSS funds: 3-year lock-in (no early exit possible)</li>
										<li>
											Check scheme documents for exact exit load structure
										</li>
									</ul>
								</div>
								<div>
									<h4 className="font-semibold mb-2">PMS Exit Charges</h4>
									<ul className="list-disc list-inside text-muted-foreground space-y-1">
										<li>As per individual PMS agreement terms</li>
										<li>Typically 1-3% if exited within lock-in period</li>
										<li>Consult your relationship manager for specifics</li>
									</ul>
								</div>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle className="flex items-center">
									<HelpCircle className="w-5 h-5 mr-2 text-blue-600" />
									How to Request a Refund
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div>
									<h4 className="font-semibold mb-2">
										Step 1: Verify Eligibility
									</h4>
									<p className="text-muted-foreground">
										Review this policy to confirm your request falls under
										refundable categories.
									</p>
								</div>
								<div>
									<h4 className="font-semibold mb-2">Step 2: Submit Request</h4>
									<ul className="list-disc list-inside text-muted-foreground space-y-1">
										<li>
											Email: refunds@fintekpro.com with transaction ID and
											reason
										</li>
										<li>
											In-app: Navigate to Orders → Select transaction → Request
											Refund
										</li>
										<li>Phone: Call customer support during business hours</li>
									</ul>
								</div>
								<div>
									<h4 className="font-semibold mb-2">
										Step 3: Provide Documentation
									</h4>
									<ul className="list-disc list-inside text-muted-foreground space-y-1">
										<li>Transaction reference number</li>
										<li>Payment screenshot (for failed transactions)</li>
										<li>Bank statement showing debit (if required)</li>
									</ul>
								</div>
								<div>
									<h4 className="font-semibold mb-2">Step 4: Track Status</h4>
									<p className="text-muted-foreground">
										You will receive updates via email/SMS. Check refund status
										in your account dashboard.
									</p>
								</div>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle className="flex items-center">
									<AlertTriangle className="w-5 h-5 mr-2 text-orange-600" />
									Special Circumstances
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-4">
								<div>
									<h4 className="font-semibold mb-2">Account Closure</h4>
									<p className="text-muted-foreground">
										Upon account closure, any unused subscription credits will
										not be refunded. Investment holdings must be redeemed or
										transferred before closure.
									</p>
								</div>
								<div>
									<h4 className="font-semibold mb-2">Regulatory Changes</h4>
									<p className="text-muted-foreground">
										If regulatory changes prevent us from providing a paid
										service, pro-rata refunds will be processed for the
										unexpired subscription period.
									</p>
								</div>
								<div>
									<h4 className="font-semibold mb-2">Disputes & Chargebacks</h4>
									<p className="text-muted-foreground">
										Please contact us before initiating a bank chargeback.
										Unauthorized chargebacks may result in account suspension
										and recovery proceedings.
									</p>
								</div>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle className="flex items-center">
									<Phone className="w-5 h-5 mr-2 text-blue-600" />
									Contact for Refund Queries
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="space-y-2 text-muted-foreground">
									<p>
										<strong>Email:</strong> refunds@fintekpro.com
									</p>
									<p>
										<strong>Customer Support:</strong> support@fintekpro.com
									</p>
									<p>
										<strong>Phone:</strong> +91-22-4000-XXXX
									</p>
									<p>
										<strong>Response Time:</strong> Within 48 hours
									</p>
									<p>
										<strong>Business Hours:</strong> Monday-Saturday, 9:00 AM -
										6:00 PM IST
									</p>
								</div>
								<div className="mt-4 pt-4 border-t">
									<p className="text-sm text-muted-foreground">
										For unresolved refund issues, escalate to our Grievance
										Officer at grievance@fintekpro.com
									</p>
								</div>
							</CardContent>
						</Card>
					</div>

					<div className="mt-12 text-center space-y-4">
						<p className="text-sm text-muted-foreground">
							This policy is effective as of January 3, 2026. We may update this
							policy with notice to users.
						</p>
						<div className="flex justify-center gap-4 text-sm">
							<Link href="/terms" className="text-blue-600 hover:underline">
								Terms of Service
							</Link>
							<span className="text-muted-foreground">|</span>
							<Link href="/privacy" className="text-blue-600 hover:underline">
								Privacy Policy
							</Link>
							<span className="text-muted-foreground">|</span>
							<Link
								href="/disclaimer"
								className="text-blue-600 hover:underline"
							>
								Risk Disclaimer
							</Link>
						</div>
					</div>
				</div>
			</main>
		</div>
	);
}
