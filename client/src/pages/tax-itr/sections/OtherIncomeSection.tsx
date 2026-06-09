import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
	FieldHint,
	CurrencyInput,
	ValidationBanner,
	formatCurrency,
} from "@/components/tax-itr/TaxITRHelpers";
import { useTax } from "../TaxContext";
import { OtherIncomeDetails } from "../types";

export const OtherIncomeSection: React.FC = (): React.ReactElement => {
	const {
		otherIncomeDetails,
		setOtherIncomeDetails,
		recommendedForm,
		totals,
		validateStep,
		currentStepId,
	} = useTax();

	const currentValidation = validateStep(currentStepId);
	const otherIncomeTotal = totals.otherIncome;

	return (
		<div className="space-y-6">
			<p className="text-muted-foreground text-sm">
				Interest, dividends, and other sources. TDS on these is usually
				reflected in your Form 26AS.
			</p>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-5">
				<div className="space-y-1.5">
					<Label htmlFor="interestIncome">
						Interest from Savings / FD / RD
						<FieldHint text="Total interest earned from savings accounts, fixed deposits, recurring deposits. Check bank statements or Form 26AS for TDS." />
					</Label>
					<CurrencyInput
						id="interestIncome"
						value={otherIncomeDetails.interestIncome}
						onChange={(v: number): void =>
							setOtherIncomeDetails((prev: OtherIncomeDetails) => ({
								...prev,
								interestIncome: v,
							}))
						}
						placeholder="All bank interest combined"
						data-testid="input-interest-income"
					/>
				</div>
				<div className="space-y-1.5">
					<Label htmlFor="dividendIncome">
						Dividend Income
						<FieldHint text="Dividends from shares and mutual funds. Taxable in your hands since FY 2020-21. Check broker statement." />
					</Label>
					<CurrencyInput
						id="dividendIncome"
						value={otherIncomeDetails.dividendIncome}
						onChange={(v: number): void =>
							setOtherIncomeDetails((prev: OtherIncomeDetails) => ({
								...prev,
								dividendIncome: v,
							}))
						}
						placeholder="From stocks, mutual funds"
						data-testid="input-dividend-income"
					/>
				</div>
				<div className="space-y-1.5">
					<Label htmlFor="otherSources">
						Other Sources
						<FieldHint text="Any income not covered above — gifts above ₹50,000, lottery winnings, etc." />
					</Label>
					<CurrencyInput
						id="otherSources"
						value={otherIncomeDetails.otherSources}
						onChange={(v: number): void =>
							setOtherIncomeDetails((prev: OtherIncomeDetails) => ({
								...prev,
								otherSources: v,
							}))
						}
						placeholder="0 if none"
						data-testid="input-other-sources"
					/>
				</div>
				<div className="space-y-1.5">
					<Label htmlFor="agriculturalIncome">
						Agricultural Income
						<FieldHint text="Income from agriculture. Exempt under Sec 10(1) but used for rate purposes if total income > ₹5 lakh. ITR-1 allows up to ₹5,000 only; above ₹5,000 requires ITR-2." />
					</Label>
					<CurrencyInput
						id="agriculturalIncome"
						value={otherIncomeDetails.agriculturalIncome}
						onChange={(v: number): void =>
							setOtherIncomeDetails((prev: OtherIncomeDetails) => ({
								...prev,
								agriculturalIncome: v,
							}))
						}
						placeholder="Exempt up to ₹5,000 for ITR-1"
						max={5000000}
						data-testid="input-agricultural-income"
					/>
					{otherIncomeDetails.agriculturalIncome > 5000 &&
						recommendedForm === "ITR-1" && (
							<p className="text-xs text-amber-600">
								Agricultural income above ₹5,000 requires ITR-2. Your form will
								be auto-upgraded.
							</p>
						)}
				</div>
			</div>

			<Card className="bg-muted/50">
				<CardContent className="p-4 space-y-1">
					<div className="flex justify-between items-center">
						<span className="font-medium">Total Other Income</span>
						<span className="font-bold text-lg">
							{formatCurrency(otherIncomeTotal)}
						</span>
					</div>
					{otherIncomeDetails.agriculturalIncome > 0 && (
						<div className="flex justify-between items-center text-xs text-muted-foreground">
							<span>Agricultural Income (exempt, for rate purposes)</span>
							<span>
								{formatCurrency(otherIncomeDetails.agriculturalIncome)}
							</span>
						</div>
					)}
				</CardContent>
			</Card>

			<ValidationBanner validation={currentValidation} />
		</div>
	);
};
