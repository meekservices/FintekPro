import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
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
import {
	Building2,
	CreditCard,
	CheckCircle2,
	AlertCircle,
	ChevronDown,
	Edit2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface BankAccount {
	id: string;
	bankName: string;
	accountNumber: string;
	accountType: string;
	isVerified: boolean;
	accountHolderName: string;
}

interface DematAccount {
	id: string;
	dematDpName: string;
	dematAccountNumber: string;
	depositoryType: string;
	isVerified: boolean;
	accountHolderName: string;
}

interface ProductAccountPreference {
	id: string;
	productType: string;
	bankAccountId: string | null;
	dematAccountId: string | null;
}

interface AccountSelectionWidgetProps {
	productType: string;
	requiresDemat?: boolean;
	selectedBankAccountId?: string;
	selectedDematAccountId?: string;
	onBankAccountChange?: (accountId: string) => void;
	onDematAccountChange?: (accountId: string) => void;
	className?: string;
	showLabels?: boolean;
	compact?: boolean;
}

export function AccountSelectionWidget({
	productType,
	requiresDemat = false,
	selectedBankAccountId,
	selectedDematAccountId,
	onBankAccountChange,
	onDematAccountChange,
	className,
	showLabels = true,
	compact = false,
}: AccountSelectionWidgetProps) {
	const [isEditing, setIsEditing] = useState(false);
	const [bankAccountId, setBankAccountId] = useState<string>(
		selectedBankAccountId || "",
	);
	const [dematAccountId, setDematAccountId] = useState<string>(
		selectedDematAccountId || "",
	);

	// Fetch bank accounts
	const { data: bankAccounts } = useQuery<BankAccount[]>({
		queryKey: ["/api/bank-accounts"],
	});

	// Fetch demat accounts
	const { data: dematAccounts } = useQuery<DematAccount[]>({
		queryKey: ["/api/demat-accounts"],
	});

	// Fetch product preferences
	const { data: preference } = useQuery<ProductAccountPreference>({
		queryKey: ["/api/product-account-preferences", productType],
		enabled: !!productType,
	});

	// Auto-select from preferences or first available account
	useEffect(() => {
		if (!selectedBankAccountId && bankAccounts?.length) {
			const preferredBankId = preference?.bankAccountId || bankAccounts[0]?.id;
			if (preferredBankId) {
				setBankAccountId(preferredBankId);
				onBankAccountChange?.(preferredBankId);
			}
		}
	}, [preference, bankAccounts, selectedBankAccountId]);

	useEffect(() => {
		if (requiresDemat && !selectedDematAccountId && dematAccounts?.length) {
			const preferredDematId =
				preference?.dematAccountId || dematAccounts[0]?.id;
			if (preferredDematId) {
				setDematAccountId(preferredDematId);
				onDematAccountChange?.(preferredDematId);
			}
		}
	}, [requiresDemat, preference, dematAccounts, selectedDematAccountId]);

	// Update local state when props change
	useEffect(() => {
		if (selectedBankAccountId) {
			setBankAccountId(selectedBankAccountId);
		}
	}, [selectedBankAccountId]);

	useEffect(() => {
		if (selectedDematAccountId) {
			setDematAccountId(selectedDematAccountId);
		}
	}, [selectedDematAccountId]);

	const handleBankAccountChange = (accountId: string) => {
		setBankAccountId(accountId);
		onBankAccountChange?.(accountId);
	};

	const handleDematAccountChange = (accountId: string) => {
		setDematAccountId(accountId);
		onDematAccountChange?.(accountId);
	};

	const selectedBank = bankAccounts?.find((acc) => acc.id === bankAccountId);
	const selectedDemat = dematAccounts?.find((acc) => acc.id === dematAccountId);

	const verifiedBankAccounts =
		bankAccounts?.filter((acc) => acc.isVerified) || [];
	const verifiedDematAccounts =
		dematAccounts?.filter((acc) => acc.isVerified) || [];

	if (!verifiedBankAccounts.length && !verifiedDematAccounts.length) {
		return (
			<Alert
				className="bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800"
				data-testid="alert-no-verified-accounts"
			>
				<AlertCircle className="h-4 w-4 text-yellow-600" />
				<AlertDescription className="text-yellow-800 dark:text-yellow-200">
					Please add and verify at least one bank account to proceed with this
					transaction.
				</AlertDescription>
			</Alert>
		);
	}

	if (compact) {
		return (
			<div
				className={cn("space-y-3", className)}
				data-testid="account-selection-compact"
			>
				<div className="flex items-center gap-2">
					<Building2 className="h-4 w-4 text-muted-foreground" />
					<Select
						value={bankAccountId}
						onValueChange={handleBankAccountChange}
						data-testid="select-bank-compact"
					>
						<SelectTrigger className="h-9">
							<SelectValue placeholder="Select bank account" />
						</SelectTrigger>
						<SelectContent>
							{verifiedBankAccounts.map((account) => (
								<SelectItem key={account.id} value={account.id}>
									{account.bankName} - {account.accountNumber.slice(-4)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				{requiresDemat && (
					<div className="flex items-center gap-2">
						<CreditCard className="h-4 w-4 text-muted-foreground" />
						<Select
							value={dematAccountId}
							onValueChange={handleDematAccountChange}
							data-testid="select-demat-compact"
						>
							<SelectTrigger className="h-9">
								<SelectValue placeholder="Select demat account" />
							</SelectTrigger>
							<SelectContent>
								{verifiedDematAccounts.map((account) => (
									<SelectItem key={account.id} value={account.id}>
										{account.dematDpName} -{" "}
										{account.dematAccountNumber.slice(-4)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				)}
			</div>
		);
	}

	return (
		<Card
			className={cn(
				"bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20",
				className,
			)}
			data-testid="account-selection-card"
		>
			<CardContent className="p-4">
				<div className="space-y-3">
					{showLabels && (
						<div className="flex items-center justify-between">
							<h3 className="font-semibold text-sm">
								Payment & Holding Accounts
							</h3>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setIsEditing(!isEditing)}
								data-testid="button-toggle-edit"
							>
								{isEditing ? (
									"Done"
								) : (
									<>
										<Edit2 className="h-3 w-3 mr-1" />
										Edit
									</>
								)}
							</Button>
						</div>
					)}

					{/* Bank Account Display/Selection */}
					<div className="space-y-2">
						<label className="text-xs font-medium text-muted-foreground">
							Bank Account (for payment)
						</label>
						{isEditing ? (
							<Select
								value={bankAccountId}
								onValueChange={handleBankAccountChange}
								data-testid="select-bank-edit"
							>
								<SelectTrigger>
									<SelectValue placeholder="Select bank account" />
								</SelectTrigger>
								<SelectContent>
									{verifiedBankAccounts.map((account) => (
										<SelectItem key={account.id} value={account.id}>
											<div className="flex items-center justify-between w-full">
												<span>
													{account.bankName} - {account.accountNumber.slice(-4)}
												</span>
												<CheckCircle2 className="h-3 w-3 text-green-600 ml-2" />
											</div>
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						) : selectedBank ? (
							<div
								className="flex items-center justify-between p-3 bg-card rounded-lg border"
								data-testid="display-selected-bank"
							>
								<div className="flex items-center gap-2">
									<Building2 className="h-4 w-4 text-blue-600" />
									<div>
										<p className="font-medium text-sm">
											{selectedBank.bankName}
										</p>
										<p className="text-xs text-muted-foreground">
											{(selectedBank.accountType || "savings").toUpperCase()} -
											****{selectedBank.accountNumber?.slice(-4) || "****"}
										</p>
									</div>
								</div>
								{selectedBank.isVerified && (
									<Badge
										variant="outline"
										className="bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800"
									>
										<CheckCircle2 className="h-3 w-3 mr-1" />
										Verified
									</Badge>
								)}
							</div>
						) : (
							<Alert className="py-2" data-testid="alert-no-bank-selected">
								<AlertCircle className="h-3 w-3" />
								<AlertDescription className="text-xs">
									No bank account selected
								</AlertDescription>
							</Alert>
						)}
					</div>

					{/* Demat Account Display/Selection */}
					{requiresDemat && (
						<div className="space-y-2">
							<label className="text-xs font-medium text-muted-foreground">
								Demat Account (for holdings)
							</label>
							{isEditing ? (
								<Select
									value={dematAccountId}
									onValueChange={handleDematAccountChange}
									data-testid="select-demat-edit"
								>
									<SelectTrigger>
										<SelectValue placeholder="Select demat account" />
									</SelectTrigger>
									<SelectContent>
										{verifiedDematAccounts.map((account) => (
											<SelectItem key={account.id} value={account.id}>
												<div className="flex items-center justify-between w-full">
													<span>
														{account.dematDpName} -{" "}
														{account.dematAccountNumber.slice(-4)}
													</span>
													<CheckCircle2 className="h-3 w-3 text-green-600 ml-2" />
												</div>
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							) : selectedDemat ? (
								<div
									className="flex items-center justify-between p-3 bg-card rounded-lg border"
									data-testid="display-selected-demat"
								>
									<div className="flex items-center gap-2">
										<CreditCard className="h-4 w-4 text-indigo-600" />
										<div>
											<p className="font-medium text-sm">
												{selectedDemat.dematDpName}
											</p>
											<p className="text-xs text-muted-foreground">
												{selectedDemat.depositoryType} - ****
												{selectedDemat.dematAccountNumber.slice(-4)}
											</p>
										</div>
									</div>
									{selectedDemat.isVerified && (
										<Badge
											variant="outline"
											className="bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800"
										>
											<CheckCircle2 className="h-3 w-3 mr-1" />
											Verified
										</Badge>
									)}
								</div>
							) : (
								<Alert className="py-2" data-testid="alert-no-demat-selected">
									<AlertCircle className="h-3 w-3" />
									<AlertDescription className="text-xs">
										No demat account selected
									</AlertDescription>
								</Alert>
							)}
						</div>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
