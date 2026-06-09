import React from "react";
import { Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	FieldHint,
	CurrencyInput,
	ValidationBanner,
	formatCurrency,
} from "@/components/tax-itr/TaxITRHelpers";
import { useTax } from "../TaxContext";
import { BusinessDetails } from "../types";

export const BusinessIncomeSection: React.FC = (): React.ReactElement => {
	const {
		recommendedForm,
		businessDetails,
		setBusinessDetails,
		validateStep,
		currentStepId,
	} = useTax();

	const currentValidation = validateStep(currentStepId);

	return (
		<div className="space-y-6">
			<div className="flex items-center gap-2 mb-2">
				<Building2 className="h-5 w-5 text-orange-600" />
				<p className="text-muted-foreground text-sm">
					{recommendedForm === "ITR-4"
						? "Presumptive taxation under Section 44AD/44ADA"
						: "Business or profession income details (ITR-3)"}
				</p>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-5">
				<div className="space-y-1.5">
					<Label>Business Type</Label>
					<Select
						value={businessDetails.businessType}
						onValueChange={(v: string): void =>
							setBusinessDetails((prev: BusinessDetails) => ({
								...prev,
								businessType: v,
							}))
						}
					>
						<SelectTrigger data-testid="select-business-type">
							<SelectValue placeholder="Select type" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="business">Business (44AD)</SelectItem>
							<SelectItem value="profession">Profession (44ADA)</SelectItem>
							<SelectItem value="transport">Goods Carriage (44AE)</SelectItem>
						</SelectContent>
					</Select>
				</div>
				<div className="space-y-1.5">
					<Label>Business Description</Label>
					<Input
						value={businessDetails.businessDescription}
						onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
							setBusinessDetails((prev: BusinessDetails) => ({
								...prev,
								businessDescription: e.target.value,
							}))
						}
						placeholder="e.g. Software consulting, Retail shop"
						data-testid="input-business-desc"
					/>
				</div>
			</div>

			<div className="flex items-center gap-3 p-3 bg-orange-50 dark:bg-orange-950 rounded-lg border border-orange-200 dark:border-orange-800">
				<Checkbox
					checked={businessDetails.isPresumptive}
					onCheckedChange={(checked: boolean): void =>
						setBusinessDetails((prev: BusinessDetails) => ({
							...prev,
							isPresumptive: !!checked,
						}))
					}
					data-testid="checkbox-presumptive"
				/>
				<div>
					<p className="text-sm font-medium text-orange-800 dark:text-orange-200">
						Presumptive Taxation Scheme
					</p>
					<p className="text-xs text-orange-600 dark:text-orange-400">
						Simplified filing under 44AD (business ≤₹3 Cr) or 44ADA (profession
						≤₹75 Lakh). No need to maintain books.
					</p>
				</div>
			</div>

			{businessDetails.isPresumptive ? (
				<div className="space-y-5">
					{businessDetails.businessType === "business" && (
						<Card className="border-orange-200 dark:border-orange-800">
							<CardContent className="p-5 space-y-4">
								<div className="flex items-center gap-2">
									<Badge
										variant="outline"
										className="bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300"
									>
										Section 44AD
									</Badge>
									<span className="text-sm text-muted-foreground">
										Presumptive Business Income
									</span>
								</div>
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div className="space-y-1.5">
										<Label>
											Gross Turnover (Annual){" "}
											<span className="text-red-500">*</span>
											<FieldHint text="Total revenue/turnover of business. For digital receipts (>95% via banking), 6% of turnover is deemed income; otherwise 8%." />
										</Label>
										<CurrencyInput
											id="grossTurnover"
											value={businessDetails.grossTurnover}
											onChange={(v: number): void => {
												const deemed = Math.round(v * 0.08);
												setBusinessDetails((prev: BusinessDetails) => ({
													...prev,
													grossTurnover: v,
													presumptiveIncome44AD: deemed,
												}));
											}}
											placeholder="e.g. 1,00,00,000"
											data-testid="input-gross-turnover"
										/>
									</div>
									<div className="space-y-1.5">
										<Label>
											Deemed Profit (8% of Turnover)
											<FieldHint text="Minimum 8% of turnover (6% for digital receipts). You can declare higher income." />
										</Label>
										<CurrencyInput
											id="presumptiveIncome44AD"
											value={businessDetails.presumptiveIncome44AD}
											onChange={(v: number): void =>
												setBusinessDetails((prev: BusinessDetails) => ({
													...prev,
													presumptiveIncome44AD: v,
												}))
											}
											data-testid="input-presumptive-44ad"
										/>
										<p className="text-xs text-muted-foreground">
											Min:{" "}
											{formatCurrency(
												Math.round(businessDetails.grossTurnover * 0.06),
											)}{" "}
											(6%) — Max:{" "}
											{formatCurrency(businessDetails.grossTurnover)} (100%)
										</p>
									</div>
								</div>
							</CardContent>
						</Card>
					)}
					{businessDetails.businessType === "profession" && (
						<Card className="border-orange-200 dark:border-orange-800">
							<CardContent className="p-5 space-y-4">
								<div className="flex items-center gap-2">
									<Badge
										variant="outline"
										className="bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300"
									>
										Section 44ADA
									</Badge>
									<span className="text-sm text-muted-foreground">
										Presumptive Professional Income
									</span>
								</div>
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div className="space-y-1.5">
										<Label>
											Gross Receipts (Annual){" "}
											<span className="text-red-500">*</span>
											<FieldHint text="Total professional receipts. 50% is deemed as net income under 44ADA." />
										</Label>
										<CurrencyInput
											id="grossReceipts"
											value={businessDetails.grossReceipts}
											onChange={(v: number): void => {
												const deemed = Math.round(v * 0.5);
												setBusinessDetails((prev: BusinessDetails) => ({
													...prev,
													grossReceipts: v,
													presumptiveIncome44ADA: deemed,
												}));
											}}
											placeholder="e.g. 50,00,000"
											data-testid="input-gross-receipts"
										/>
									</div>
									<div className="space-y-1.5">
										<Label>
											Deemed Profit (50% of Receipts)
											<FieldHint text="Minimum 50% of gross receipts. You can declare higher." />
										</Label>
										<CurrencyInput
											id="presumptiveIncome44ADA"
											value={businessDetails.presumptiveIncome44ADA}
											onChange={(v: number): void =>
												setBusinessDetails((prev: BusinessDetails) => ({
													...prev,
													presumptiveIncome44ADA: v,
												}))
											}
											data-testid="input-presumptive-44ada"
										/>
									</div>
								</div>
							</CardContent>
						</Card>
					)}
					{businessDetails.businessType === "transport" && (
						<Card className="border-orange-200 dark:border-orange-800">
							<CardContent className="p-5 space-y-4">
								<div className="flex items-center gap-2">
									<Badge
										variant="outline"
										className="bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300"
									>
										Section 44AE
									</Badge>
									<span className="text-sm text-muted-foreground">
										Goods Carriage Income (≤10 vehicles)
									</span>
								</div>
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div className="space-y-1.5">
										<Label>
											Number of Goods Vehicles{" "}
											<span className="text-red-500">*</span>
											<FieldHint text="Total vehicles owned at any time during the year. Section 44AE is limited to ≤10 vehicles." />
										</Label>
										<Input
											type="number"
											min={0}
											max={10}
											value={businessDetails.vehicleCount || ""}
											onChange={(
												e: React.ChangeEvent<HTMLInputElement>,
											): void => {
												const count = Number.parseInt(e.target.value) || 0;
												const deemed = count * 7500 * 12;
												setBusinessDetails((prev: BusinessDetails) => ({
													...prev,
													vehicleCount: count,
													presumptiveIncome44AE: deemed,
												}));
											}}
											placeholder="e.g. 5"
											data-testid="input-vehicle-count"
										/>
									</div>
									<div className="space-y-1.5">
										<Label>
											Deemed Profit (₹7,500/vehicle/month)
											<FieldHint text="₹7,500 per month per vehicle for light goods vehicles. ₹1,000 per ton per month for heavy vehicles." />
										</Label>
										<CurrencyInput
											id="presumptiveIncome44AE"
											value={businessDetails.presumptiveIncome44AE}
											onChange={(v: number): void =>
												setBusinessDetails((prev: BusinessDetails) => ({
													...prev,
													presumptiveIncome44AE: v,
												}))
											}
											data-testid="input-presumptive-44ae"
										/>
										<p className="text-xs text-muted-foreground">
											Auto-calculated: {businessDetails.vehicleCount} × ₹7,500 ×
											12 ={" "}
											{formatCurrency(businessDetails.vehicleCount * 7500 * 12)}
										</p>
									</div>
								</div>
							</CardContent>
						</Card>
					)}
				</div>
			) : (
				<div className="space-y-5">
					<Card>
						<CardContent className="p-5 space-y-4">
							<p className="text-sm font-medium">
								Regular Business Income (Non-Presumptive)
							</p>
							<p className="text-xs text-muted-foreground">
								You must maintain books of accounts. Tax audit required if
								turnover exceeds prescribed limits.
							</p>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<div className="space-y-1.5">
									<Label>
										Net Business Income <span className="text-red-500">*</span>
									</Label>
									<CurrencyInput
										id="businessIncome"
										value={businessDetails.businessIncome}
										onChange={(v: number): void =>
											setBusinessDetails((prev: BusinessDetails) => ({
												...prev,
												businessIncome: v,
											}))
										}
										placeholder="Net profit from P&L account"
										data-testid="input-business-income"
									/>
								</div>
								<div className="space-y-1.5">
									<Label>Gross Turnover</Label>
									<CurrencyInput
										id="nonPresumptiveTurnover"
										value={businessDetails.grossTurnover}
										onChange={(v: number): void =>
											setBusinessDetails((prev: BusinessDetails) => ({
												...prev,
												grossTurnover: v,
											}))
										}
										placeholder="Total turnover/receipts"
										data-testid="input-non-presumptive-turnover"
									/>
								</div>
							</div>
						</CardContent>
					</Card>
				</div>
			)}

			<ValidationBanner validation={currentValidation} />
		</div>
	);
};
