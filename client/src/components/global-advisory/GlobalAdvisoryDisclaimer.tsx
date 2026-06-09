import { useState } from "react";
import {
	AlertTriangle,
	Shield as LucideShield,
	ExternalLink,
	CheckCircle,
} from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRecordAcknowledgment } from "@/hooks/use-global-advisory";
import { useToast } from "@/hooks/use-toast";

const DISCLAIMER_VERSION = "v1.0";

const GLOBAL_ADVISORY_DISCLAIMER = `
IMPORTANT DISCLAIMER - GLOBAL ADVISORY SERVICES

Please read and understand the following terms before accessing Global Advisory features:

1. ANALYTICS-ONLY ADVISORY
Global Advisory services for markets outside India are provided on an "Analytics-Only" basis. This means:
- You will receive market insights, analytics, signals, and recommendations
- NO execution, trading, or order placement services are available outside India
- All investment decisions and execution must be done through your own broker

2. REGULATORY COMPLIANCE
- FintekPro is registered with SEBI (Securities and Exchange Board of India) for advisory services
- Our registration does NOT authorize execution or brokerage services in international markets
- We comply with SEBI guidelines for cross-border advisory services

3. EXECUTION RESPONSIBILITY
- You are solely responsible for executing any trades based on our analytics
- We recommend using licensed brokers in the respective markets
- Verify regulatory compliance of your chosen broker
- Understand local tax implications of international investments

4. NO INVESTMENT ADVICE
- Analytics and signals provided are for informational purposes only
- They do not constitute personalized investment advice
- Past performance is not indicative of future results
- Consult with a qualified financial advisor before making investment decisions

5. CURRENCY AND FX RISK
- International investments involve currency exchange risk
- Returns displayed in INR include estimated FX impact
- Actual returns may vary based on exchange rate fluctuations

6. DATA SOURCES
- Market data is sourced from reputable third-party providers
- Data may be delayed or subject to inaccuracies
- Verify critical information with official sources

7. LIMITATION OF LIABILITY
- FintekPro shall not be liable for any losses arising from:
  - Investment decisions based on our analytics
  - Third-party broker actions or failures
  - Currency fluctuations
  - Market conditions or regulatory changes

By clicking "I Understand & Accept", you acknowledge that you have read, understood, and agree to these terms.
`;

interface GlobalAdvisoryDisclaimerProps {
	marketCode: string;
	marketName: string;
	isOpen: boolean;
	onAccept: () => void;
	onDecline: () => void;
}

export function GlobalAdvisoryDisclaimer({
	marketCode,
	marketName,
	isOpen,
	onAccept,
	onDecline,
}: GlobalAdvisoryDisclaimerProps) {
	const { toast } = useToast();
	const [hasRead, setHasRead] = useState(false);
	const [hasAcknowledged, setHasAcknowledged] = useState(false);
	const recordAcknowledgment = useRecordAcknowledgment();

	const handleAccept = async () => {
		if (!hasRead || !hasAcknowledged) {
			toast({
				title: "Please complete all acknowledgments",
				description:
					"You must read and acknowledge all terms before proceeding",
				variant: "destructive",
			});
			return;
		}

		try {
			await recordAcknowledgment.mutateAsync({
				marketCode,
				acknowledgmentType: "global_advisory_disclaimer",
				disclaimerVersion: DISCLAIMER_VERSION,
				disclaimerText: GLOBAL_ADVISORY_DISCLAIMER,
			});

			toast({
				title: "Disclaimer Accepted",
				description: `You can now access ${marketName} analytics`,
			});

			onAccept();
		} catch (error: any) {
			toast({
				title: "Error",
				description: error.message || "Failed to record acknowledgment",
				variant: "destructive",
			});
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && onDecline()}>
			<DialogContent
				className="max-w-2xl max-h-[90vh]"
				data-testid="global-advisory-disclaimer-modal"
			>
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2 text-xl">
						<LucideShield className="h-6 w-6 text-primary" />
						Global Advisory Disclaimer
					</DialogTitle>
					<DialogDescription>
						Before accessing {marketName} market analytics
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
						<AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 mt-0.5 flex-shrink-0" />
						<div className="text-sm text-amber-800 dark:text-amber-200">
							<strong>Analytics-Only Mode:</strong> This market operates in
							analytics-only mode. You will receive insights and signals, but
							cannot execute trades through FintekPro. Please use your own
							licensed broker for any transactions.
						</div>
					</div>

					<ScrollArea className="h-64 border rounded-lg p-4 bg-muted/30/50">
						<pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed text-foreground">
							{GLOBAL_ADVISORY_DISCLAIMER}
						</pre>
					</ScrollArea>

					<div className="space-y-3">
						<div className="flex items-start space-x-3">
							<Checkbox
								id="hasRead"
								checked={hasRead}
								onCheckedChange={(checked) => setHasRead(checked === true)}
								data-testid="checkbox-has-read"
							/>
							<Label htmlFor="hasRead" className="text-sm cursor-pointer">
								I have read and understood the disclaimer above
							</Label>
						</div>

						<div className="flex items-start space-x-3">
							<Checkbox
								id="hasAcknowledged"
								checked={hasAcknowledged}
								onCheckedChange={(checked) =>
									setHasAcknowledged(checked === true)
								}
								data-testid="checkbox-has-acknowledged"
							/>
							<Label
								htmlFor="hasAcknowledged"
								className="text-sm cursor-pointer"
							>
								I acknowledge that FintekPro provides analytics-only advisory
								for {marketName}
								and I am responsible for executing trades through my own broker
							</Label>
						</div>
					</div>
				</div>

				<DialogFooter className="flex-col sm:flex-row gap-2">
					<Button
						variant="outline"
						onClick={onDecline}
						data-testid="button-decline-disclaimer"
					>
						Cancel
					</Button>
					<Button
						onClick={handleAccept}
						disabled={
							!hasRead || !hasAcknowledged || recordAcknowledgment.isPending
						}
						data-testid="button-accept-disclaimer"
					>
						{recordAcknowledgment.isPending ? (
							"Processing..."
						) : (
							<>
								<CheckCircle className="h-4 w-4 mr-2" />I Understand & Accept
							</>
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

interface ExecutionRedirectModalProps {
	marketCode: string;
	marketName: string;
	isOpen: boolean;
	onClose: () => void;
}

export function ExecutionRedirectModal({
	marketCode,
	marketName,
	isOpen,
	onClose,
}: ExecutionRedirectModalProps) {
	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
			<DialogContent
				className="max-w-md"
				data-testid="execution-redirect-modal"
			>
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<ExternalLink className="h-5 w-5 text-primary" />
						Execute with Your Broker
					</DialogTitle>
					<DialogDescription>
						Execution is not available for {marketName}
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-4">
					<div className="text-sm text-muted-foreground">
						To execute trades in the {marketName} market, please use your
						licensed broker. FintekPro provides analytics and signals only for
						international markets.
					</div>

					<div className="p-4 bg-muted/50/30 rounded-lg space-y-2 border border-border">
						<div className="font-medium text-foreground">
							Recommended Steps:
						</div>
						<ol className="list-decimal list-inside text-sm space-y-1 text-muted-foreground">
							<li>Login to your broker's trading platform</li>
							<li>Search for the instrument you wish to trade</li>
							<li>Place your order according to your investment plan</li>
							<li>Track your portfolio separately or import it to FintekPro</li>
						</ol>
					</div>
				</div>

				<DialogFooter>
					<Button onClick={onClose} data-testid="button-close-redirect">
						Got it
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
