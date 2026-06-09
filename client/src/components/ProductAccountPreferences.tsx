import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
	Settings,
	Save,
	X,
	Banknote,
	Building2,
	CreditCard,
	CheckCircle2,
	Info,
} from "lucide-react";

interface BankAccount {
	id: string;
	bankName: string;
	accountNumber: string;
	isVerified: boolean;
}

interface DematAccount {
	id: string;
	dematDpName: string;
	dematAccountNumber: string;
	depositoryType: string;
	isVerified: boolean;
}

interface ProductAccountPreference {
	id: string;
	productType: string;
	bankAccountId: string | null;
	dematAccountId: string | null;
	isActive: boolean;
}

const PRODUCT_TYPES = [
	{
		value: "mutual_fund",
		label: "Mutual Funds",
		requiresDemat: false,
		icon: <Banknote className="h-4 w-4" />,
	},
	{
		value: "ipo",
		label: "IPO Applications",
		requiresDemat: true,
		icon: <Building2 className="h-4 w-4" />,
	},
	{
		value: "bond",
		label: "Bonds",
		requiresDemat: true,
		icon: <CreditCard className="h-4 w-4" />,
	},
	{
		value: "equity",
		label: "Equity Trading",
		requiresDemat: true,
		icon: <Building2 className="h-4 w-4" />,
	},
	{
		value: "aif",
		label: "Alternative Investment Funds",
		requiresDemat: false,
		icon: <Banknote className="h-4 w-4" />,
	},
	{
		value: "pms",
		label: "Portfolio Management Services",
		requiresDemat: false,
		icon: <Banknote className="h-4 w-4" />,
	},
	{
		value: "unlisted_share",
		label: "Unlisted Shares",
		requiresDemat: true,
		icon: <Building2 className="h-4 w-4" />,
	},
	{
		value: "etf",
		label: "ETFs",
		requiresDemat: true,
		icon: <Building2 className="h-4 w-4" />,
	},
	{
		value: "fd",
		label: "Fixed Deposits",
		requiresDemat: false,
		icon: <CreditCard className="h-4 w-4" />,
	},
];

export function ProductAccountPreferences() {
	const { toast } = useToast();
	const queryClient = useQueryClient();
	const [preferences, setPreferences] = useState<
		Record<
			string,
			{ bankAccountId: string | null; dematAccountId: string | null }
		>
	>({});

	// Fetch data
	const { data: bankAccounts } = useQuery<BankAccount[]>({
		queryKey: ["/api/bank-accounts"],
	});

	const { data: dematAccounts } = useQuery<DematAccount[]>({
		queryKey: ["/api/demat-accounts"],
	});

	const { data: existingPreferences } = useQuery<ProductAccountPreference[]>({
		queryKey: ["/api/product-account-preferences"],
	});

	// Initialize preferences from existing data
	useEffect(() => {
		if (existingPreferences) {
			const prefsMap: Record<
				string,
				{ bankAccountId: string | null; dematAccountId: string | null }
			> = {};
			existingPreferences.forEach((pref) => {
				prefsMap[pref.productType] = {
					bankAccountId: pref.bankAccountId,
					dematAccountId: pref.dematAccountId,
				};
			});
			setPreferences(prefsMap);
		}
	}, [existingPreferences]);

	// Save/Update preference mutation
	const savePreferenceMutation = useMutation({
		mutationFn: async ({
			productType,
			bankAccountId,
			dematAccountId,
		}: {
			productType: string;
			bankAccountId: string | null;
			dematAccountId: string | null;
		}) => {
			const existingPref = existingPreferences?.find(
				(p) => p.productType === productType,
			);

			if (existingPref) {
				// Update existing preference
				return apiRequest(
					"PUT",
					`/api/product-account-preferences/${existingPref.id}`,
					{
						body: { bankAccountId, dematAccountId },
					},
				);
			}
			// Create new preference
			return apiRequest("POST", "/api/product-account-preferences", {
				body: {
					productType,
					bankAccountId,
					dematAccountId,
					isActive: true,
					isDefault: true,
				},
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["/api/product-account-preferences"],
			});
			toast({
				title: "Preference Saved",
				description: "Your account preference has been updated successfully.",
			});
		},
		onError: (error: any) => {
			toast({
				variant: "destructive",
				title: "Error",
				description: error.message || "Failed to save preference",
			});
		},
	});

	const handleBankAccountChange = (
		productType: string,
		bankAccountId: string,
	) => {
		const newPrefs = {
			...preferences,
			[productType]: {
				...preferences[productType],
				bankAccountId: bankAccountId === "none" ? null : bankAccountId,
			},
		};
		setPreferences(newPrefs);
	};

	const handleDematAccountChange = (
		productType: string,
		dematAccountId: string,
	) => {
		const newPrefs = {
			...preferences,
			[productType]: {
				...preferences[productType],
				dematAccountId: dematAccountId === "none" ? null : dematAccountId,
			},
		};
		setPreferences(newPrefs);
	};

	const handleSave = (productType: string) => {
		const pref = preferences[productType] || {
			bankAccountId: null,
			dematAccountId: null,
		};
		savePreferenceMutation.mutate({
			productType,
			bankAccountId: pref.bankAccountId,
			dematAccountId: pref.dematAccountId,
		});
	};

	const hasUnsavedChanges = (productType: string) => {
		const currentPref = preferences[productType];
		const existingPref = existingPreferences?.find(
			(p) => p.productType === productType,
		);

		if (!currentPref && !existingPref) return false;
		if (!currentPref || !existingPref) return true;

		return (
			currentPref.bankAccountId !== existingPref.bankAccountId ||
			currentPref.dematAccountId !== existingPref.dematAccountId
		);
	};

	if (!bankAccounts?.length && !dematAccounts?.length) {
		return (
			<Alert data-testid="alert-no-accounts">
				<Info className="h-4 w-4" />
				<AlertDescription>
					Please add bank and demat accounts first before configuring product
					preferences.
				</AlertDescription>
			</Alert>
		);
	}

	return (
		<Card data-testid="card-product-preferences">
			<CardHeader>
				<div className="flex items-center gap-2">
					<Settings className="h-5 w-5" />
					<CardTitle>Product Account Preferences</CardTitle>
				</div>
				<CardDescription>
					Configure which bank and demat accounts to use for each product type.
					This helps streamline your transactions.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-6">
				{PRODUCT_TYPES.map((product) => {
					const pref = preferences[product.value] || {
						bankAccountId: null,
						dematAccountId: null,
					};
					const isChanged = hasUnsavedChanges(product.value);

					return (
						<div
							key={product.value}
							className="border rounded-lg p-4 space-y-4"
							data-testid={`product-pref-${product.value}`}
						>
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									{product.icon}
									<h3 className="font-semibold">{product.label}</h3>
									{product.requiresDemat && (
										<Badge variant="secondary" className="text-xs">
											Requires Demat
										</Badge>
									)}
								</div>
								{isChanged && (
									<Button
										size="sm"
										onClick={() => handleSave(product.value)}
										disabled={savePreferenceMutation.isPending}
										data-testid={`button-save-${product.value}`}
									>
										<Save className="h-3 w-3 mr-1" />
										Save
									</Button>
								)}
							</div>

							<div className="grid md:grid-cols-2 gap-4">
								<div className="space-y-2">
									<label className="text-sm font-medium">Bank Account</label>
									<Select
										value={pref.bankAccountId || "none"}
										onValueChange={(value) =>
											handleBankAccountChange(product.value, value)
										}
										data-testid={`select-bank-${product.value}`}
									>
										<SelectTrigger>
											<SelectValue placeholder="Select bank account" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="none">None</SelectItem>
											{bankAccounts?.map((account) => (
												<SelectItem key={account.id} value={account.id}>
													<div className="flex items-center gap-2">
														<span>
															{account.bankName} -{" "}
															{account.accountNumber.slice(-4)}
														</span>
														{account.isVerified && (
															<CheckCircle2 className="h-3 w-3 text-green-600" />
														)}
													</div>
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>

								{product.requiresDemat && (
									<div className="space-y-2">
										<label className="text-sm font-medium">Demat Account</label>
										<Select
											value={pref.dematAccountId || "none"}
											onValueChange={(value) =>
												handleDematAccountChange(product.value, value)
											}
											data-testid={`select-demat-${product.value}`}
										>
											<SelectTrigger>
												<SelectValue placeholder="Select demat account" />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="none">None</SelectItem>
												{dematAccounts?.map((account) => (
													<SelectItem key={account.id} value={account.id}>
														<div className="flex items-center gap-2">
															<span>
																{account.dematDpName} -{" "}
																{account.dematAccountNumber.slice(-4)}
															</span>
															{account.isVerified && (
																<CheckCircle2 className="h-3 w-3 text-green-600" />
															)}
														</div>
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
								)}
							</div>
						</div>
					);
				})}
			</CardContent>
		</Card>
	);
}
