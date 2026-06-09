import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
	AlertTriangle,
	Shield as LucideShield,
	Clock,
	FileText,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { type SchemeType } from "@/hooks/use-consent";

interface ConsentDialogProps {
	isOpen: boolean;
	onOpenChange: (open: boolean) => void;
	panNumber: string;
	schemeType: SchemeType;
	onConsentGranted: () => void;
}

const SCHEME_NAMES: Record<SchemeType, string> = {
	epf: "Employee Provident Fund (EPF)",
	ppf: "Public Provident Fund (PPF)",
	eps: "Employee Pension Scheme (EPS)",
	nps: "National Pension System (NPS)",
	apy: "Atal Pension Yojana (APY)",
	insurance: "Insurance Holdings",
};

const SCHEME_DESCRIPTIONS: Record<SchemeType, string> = {
	epf: "View your EPF account balance, contribution history, and current status from EPFO records.",
	ppf: "Access your PPF account balance, maturity details, and contribution records from bank records.",
	eps: "Check your EPS pension benefits, monthly pension amount, and service history from EPFO.",
	nps: "View your NPS account balance, fund allocation, and retirement corpus details from CRA.",
	apy: "Check your APY pension details, contribution status, and guaranteed pension amount.",
	insurance:
		"Access your insurance policy holdings from NSDL and CDSL depository records.",
};

export function ConsentDialog({
	isOpen,
	onOpenChange,
	panNumber,
	schemeType,
	onConsentGranted,
}: ConsentDialogProps) {
	const [hasReadTerms, setHasReadTerms] = useState(false);
	const [purpose, setPurpose] = useState(
		"Access government scheme holdings data for portfolio management and financial planning",
	);
	const { toast } = useToast();
	const queryClient = useQueryClient();

	const consentMutation = useMutation({
		mutationFn: async () => {
			return await apiRequest("/api/government-schemes/consent", {
				method: "POST",
				body: JSON.stringify({
					panNumber,
					schemeType,
					purpose,
				}),
				headers: {
					"Content-Type": "application/json",
				},
			});
		},
		onSuccess: () => {
			toast({
				title: "Consent Granted",
				description: `Successfully granted access to ${SCHEME_NAMES[schemeType]} data.`,
			});
			queryClient.invalidateQueries({
				queryKey: ["government-schemes", "consent"],
			});
			onConsentGranted();
			onOpenChange(false);
		},
		onError: (error) => {
			console.error("Consent error:", error);
			toast({
				title: "Consent Failed",
				description: "Failed to grant consent. Please try again.",
				variant: "destructive",
			});
		},
	});

	const handleGrantConsent = () => {
		if (!hasReadTerms) {
			toast({
				title: "Please Review Terms",
				description:
					"You must read and accept the terms and conditions to proceed.",
				variant: "destructive",
			});
			return;
		}
		consentMutation.mutate();
	};

	return (
		<Dialog open={isOpen} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-2xl" data-testid="dialog-consent">
				<DialogHeader>
					<DialogTitle
						className="flex items-center gap-2"
						data-testid="text-consent-title"
					>
						<LucideShield className="h-5 w-5 text-blue-600" />
						Data Access Consent Required
					</DialogTitle>
					<DialogDescription data-testid="text-consent-description">
						FintekPro is requesting permission to access your{" "}
						{SCHEME_NAMES[schemeType]} data linked to PAN number:{" "}
						<span className="font-mono font-bold">{panNumber}</span>
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-6">
					{/* Data Access Information */}
					<div className="border rounded-lg p-4 bg-blue-50 dark:bg-blue-950/20">
						<h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
							<FileText className="h-4 w-4" />
							What data will be accessed?
						</h3>
						<p className="text-blue-800 dark:text-blue-200 text-sm">
							{SCHEME_DESCRIPTIONS[schemeType]}
						</p>
					</div>

					{/* Purpose Input */}
					<div className="space-y-2">
						<Label htmlFor="purpose" className="text-sm font-medium">
							Purpose of data access
						</Label>
						<Textarea
							id="purpose"
							value={purpose}
							onChange={(e) => setPurpose(e.target.value)}
							placeholder="Describe why you need access to this data..."
							className="min-h-20"
							data-testid="input-consent-purpose"
						/>
					</div>

					{/* Security Information */}
					<div className="border rounded-lg p-4 bg-amber-50 dark:bg-amber-950/20">
						<h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-2 flex items-center gap-2">
							<AlertTriangle className="h-4 w-4" />
							Important Security Information
						</h3>
						<ul className="text-amber-800 dark:text-amber-200 text-sm space-y-1">
							<li>• Your data is accessed through secure government APIs</li>
							<li>• Information is encrypted and never stored permanently</li>
							<li>
								• Access is limited to portfolio management functions only
							</li>
							<li>• You can revoke this consent at any time</li>
						</ul>
					</div>

					{/* Consent Duration */}
					<div className="border rounded-lg p-4 bg-green-50 dark:bg-green-950/20">
						<h3 className="font-semibold text-green-900 dark:text-green-100 mb-2 flex items-center gap-2">
							<Clock className="h-4 w-4" />
							Consent Duration
						</h3>
						<p className="text-green-800 dark:text-green-200 text-sm">
							This consent will be valid for <strong>1 year</strong> from today.
							You will be prompted to renew consent when it expires.
						</p>
					</div>

					{/* Terms Acceptance */}
					<div className="flex items-start space-x-3 p-4 border rounded-lg">
						<Checkbox
							id="terms"
							checked={hasReadTerms}
							onCheckedChange={(checked) => setHasReadTerms(checked === true)}
							data-testid="checkbox-consent-terms"
						/>
						<div className="grid gap-1.5 leading-none">
							<Label
								htmlFor="terms"
								className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
							>
								I have read and agree to the terms and conditions
							</Label>
							<p className="text-xs text-muted-foreground">
								By checking this box, you consent to FintekPro accessing your{" "}
								{SCHEME_NAMES[schemeType]}
								data for the stated purpose. This consent complies with data
								protection regulations.
							</p>
						</div>
					</div>
				</div>

				<DialogFooter className="gap-2 flex-col sm:flex-row">
					<Button
						variant="outline"
						className="w-full sm:w-auto"
						onClick={() => onOpenChange(false)}
						data-testid="button-consent-cancel"
					>
						Cancel
					</Button>
					<Button
						className="w-full sm:w-auto"
						onClick={handleGrantConsent}
						disabled={!hasReadTerms || consentMutation.isPending}
						data-testid="button-consent-grant"
					>
						{consentMutation.isPending ? "Granting..." : "Grant Consent"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
