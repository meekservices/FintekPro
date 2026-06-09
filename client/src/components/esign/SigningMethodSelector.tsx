import { useState } from "react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import {
	Fingerprint,
	Smartphone,
	CreditCard,
	Mail,
	QrCode,
	Users,
	FileStack,
	Video,
	MessageSquare,
	Shield as LucideShield,
	Check,
	Info,
	Zap,
} from "lucide-react";

export type SigningMethod =
	| "aadhaar_esign"
	| "dsc_token"
	| "email_otp"
	| "whatsapp_otp"
	| "qr_code"
	| "in_person"
	| "zoho_sign";

interface SigningMethodOption {
	id: SigningMethod;
	name: string;
	description: string;
	icon: typeof Fingerprint;
	features: string[];
	legalValidity: "high" | "medium" | "low";
	costPerSign?: number;
	recommended?: boolean;
	available: boolean;
	requiresAadhaar?: boolean;
	requiresHardware?: boolean;
}

const SIGNING_METHODS: SigningMethodOption[] = [
	{
		id: "aadhaar_esign",
		name: "Aadhaar eSign",
		description: "OTP-based digital signature using Aadhaar verification",
		icon: Fingerprint,
		features: ["UIDAI Verified", "Legal Validity", "Instant", "No Hardware"],
		legalValidity: "high",
		costPerSign: 8,
		recommended: true,
		available: true,
		requiresAadhaar: true,
	},
	{
		id: "dsc_token",
		name: "DSC Token",
		description: "Digital Signature Certificate via USB Token or Smart Card",
		icon: CreditCard,
		features: [
			"Class 2/3 DSC",
			"No OTP",
			"Offline Capable",
			"Highest Security",
		],
		legalValidity: "high",
		costPerSign: 0,
		available: true,
		requiresHardware: true,
	},
	{
		id: "email_otp",
		name: "Email OTP",
		description: "Simple verification via one-time password sent to email",
		icon: Mail,
		features: ["Quick Setup", "No Aadhaar", "Email Verification", "Basic"],
		legalValidity: "medium",
		costPerSign: 0,
		available: true,
	},
	{
		id: "whatsapp_otp",
		name: "WhatsApp eSign",
		description: "Document link and OTP verification via WhatsApp",
		icon: MessageSquare,
		features: [
			"Mobile First",
			"Instant Delivery",
			"High Open Rate",
			"Convenient",
		],
		legalValidity: "medium",
		costPerSign: 0.5,
		available: true,
	},
	{
		id: "qr_code",
		name: "QR Code Sign",
		description: "Scan QR to sign on personal device",
		icon: QrCode,
		features: ["Branch/Office Use", "Personal Device", "Secure", "Quick"],
		legalValidity: "medium",
		costPerSign: 0,
		available: true,
	},
	{
		id: "in_person",
		name: "In-Person Witness",
		description: "Agent witnesses client signing with geo-location and photo",
		icon: Users,
		features: ["Geo-Tagged", "Photo Capture", "Witness Mode", "High Assurance"],
		legalValidity: "high",
		costPerSign: 0,
		available: true,
	},
	{
		id: "zoho_sign",
		name: "Zoho Sign",
		description: "Cloud-based electronic signature via Zoho platform",
		icon: LucideShield,
		features: ["Cloud Based", "Templates", "Audit Trail", "Reminders"],
		legalValidity: "high",
		costPerSign: 5,
		available: true,
	},
];

interface SigningMethodSelectorProps {
	selectedMethod?: SigningMethod;
	onSelect: (method: SigningMethod) => void;
	signerHasAadhaar?: boolean;
	allowMultiple?: boolean;
	selectedMethods?: SigningMethod[];
	onMultiSelect?: (methods: SigningMethod[]) => void;
	compact?: boolean;
}

export function SigningMethodSelector({
	selectedMethod,
	onSelect,
	signerHasAadhaar = true,
	allowMultiple = false,
	selectedMethods = [],
	onMultiSelect,
	compact = false,
}: SigningMethodSelectorProps) {
	const [hoveredMethod, setHoveredMethod] = useState<SigningMethod | null>(
		null,
	);

	const handleSelect = (methodId: SigningMethod) => {
		if (allowMultiple && onMultiSelect) {
			if (selectedMethods.includes(methodId)) {
				onMultiSelect(selectedMethods.filter((m) => m !== methodId));
			} else {
				onMultiSelect([...selectedMethods, methodId]);
			}
		} else {
			onSelect(methodId);
		}
	};

	const isSelected = (methodId: SigningMethod) => {
		if (allowMultiple) {
			return selectedMethods.includes(methodId);
		}
		return selectedMethod === methodId;
	};

	const isMethodAvailable = (method: SigningMethodOption) => {
		if (!method.available) return false;
		if (method.requiresAadhaar && !signerHasAadhaar) return false;
		return true;
	};

	const getLegalBadge = (level: string) => {
		switch (level) {
			case "high":
				return (
					<Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
						High Legal Validity
					</Badge>
				);
			case "medium":
				return (
					<Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
						Medium Legal Validity
					</Badge>
				);
			case "low":
				return (
					<Badge className="bg-muted text-muted-foreground/30">
						Basic Validity
					</Badge>
				);
			default:
				return null;
		}
	};

	if (compact) {
		return (
			<RadioGroup
				value={selectedMethod}
				onValueChange={(v) => onSelect(v as SigningMethod)}
			>
				<div className="grid grid-cols-2 gap-2">
					{SIGNING_METHODS.filter((m) => isMethodAvailable(m)).map((method) => (
						<div key={method.id} className="flex items-center space-x-2">
							<RadioGroupItem value={method.id} id={method.id} />
							<Label
								htmlFor={method.id}
								className="flex items-center gap-2 cursor-pointer"
							>
								<method.icon className="h-4 w-4" />
								<span className="text-sm">{method.name}</span>
								{method.recommended && (
									<Badge variant="outline" className="text-xs">
										<Zap className="h-3 w-3 mr-1" />
										Recommended
									</Badge>
								)}
							</Label>
						</div>
					))}
				</div>
			</RadioGroup>
		);
	}

	return (
		<div className="space-y-4">
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
				{SIGNING_METHODS.map((method) => {
					const available = isMethodAvailable(method);
					const selected = isSelected(method.id);
					const MethodIcon = method.icon;

					return (
						<Card
							key={method.id}
							className={cn(
								"cursor-pointer transition-all relative",
								selected && "border-emerald-500 ring-2 ring-emerald-500/20",
								!available && "opacity-50 cursor-not-allowed",
								available && !selected && "hover:border-emerald-400",
							)}
							onClick={() => available && handleSelect(method.id)}
							onMouseEnter={() => setHoveredMethod(method.id)}
							onMouseLeave={() => setHoveredMethod(null)}
						>
							{method.recommended && (
								<div className="absolute -top-2 -right-2">
									<Badge className="bg-emerald-600">
										<Zap className="h-3 w-3 mr-1" />
										Recommended
									</Badge>
								</div>
							)}

							{selected && (
								<div className="absolute top-2 right-2">
									<div className="h-5 w-5 rounded-full bg-emerald-600 flex items-center justify-center">
										<Check className="h-3 w-3 text-foreground" />
									</div>
								</div>
							)}

							<CardHeader className="pb-2">
								<div className="flex items-center gap-3">
									<div
										className={cn(
											"h-10 w-10 rounded-lg flex items-center justify-center",
											selected
												? "bg-emerald-100 dark:bg-emerald-900/30"
												: "bg-muted",
										)}
									>
										<MethodIcon
											className={cn(
												"h-5 w-5",
												selected ? "text-emerald-600" : "text-muted-foreground",
											)}
										/>
									</div>
									<div>
										<CardTitle className="text-base">{method.name}</CardTitle>
										{method.costPerSign !== undefined && (
											<span className="text-xs text-muted-foreground">
												{method.costPerSign === 0
													? "Free"
													: `₹${method.costPerSign}/sign`}
											</span>
										)}
									</div>
								</div>
							</CardHeader>

							<CardContent className="pt-0">
								<CardDescription className="text-sm mb-3">
									{method.description}
								</CardDescription>

								<div className="flex flex-wrap gap-1 mb-2">
									{method.features.slice(0, 3).map((feature, i) => (
										<Badge key={i} variant="secondary" className="text-xs">
											{feature}
										</Badge>
									))}
								</div>

								{getLegalBadge(method.legalValidity)}

								{!available && method.requiresAadhaar && !signerHasAadhaar && (
									<Alert className="mt-2 py-2">
										<Info className="h-3 w-3" />
										<AlertDescription className="text-xs">
											Signer's Aadhaar required
										</AlertDescription>
									</Alert>
								)}

								{method.requiresHardware && (
									<div className="text-xs text-muted-foreground mt-2">
										Requires USB Token or Smart Card
									</div>
								)}
							</CardContent>
						</Card>
					);
				})}
			</div>

			{selectedMethod && (
				<Alert>
					<Check className="h-4 w-4" />
					<AlertDescription>
						Selected:{" "}
						<strong>
							{SIGNING_METHODS.find((m) => m.id === selectedMethod)?.name}
						</strong>
						{" - "}
						{SIGNING_METHODS.find((m) => m.id === selectedMethod)?.description}
					</AlertDescription>
				</Alert>
			)}
		</div>
	);
}

export default SigningMethodSelector;
