import React from "react";
import { Info, Plus, Trash2 } from "lucide-react";
import {
	Card,
	CardHeader,
	CardTitle,
	CardContent,
	CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { useTax } from "../TaxContext";
import {
	BalanceSheet,
	ProfitLoss,
	BalanceSheetDetails,
	ProfitLossDetails,
	DepreciationEntry,
	TaxAuditInfo,
	FOIncome,
} from "../types";

export const FinancialsSection: React.FC = (): React.ReactElement => {
	const {
		recommendedForm,
		balanceSheet,
		setBalanceSheet,
		profitLoss,
		setProfitLoss,
		depreciationEntries,
		setDepreciationEntries,
		taxAuditInfo,
		setTaxAuditInfo,
		foIncome,
		setFoIncome,
	} = useTax();
	const autoTotalAssets =
		balanceSheet.fixedAssets +
		balanceSheet.investments +
		balanceSheet.currentAssets +
		balanceSheet.loansAndAdvances +
		balanceSheet.otherAssets;
	const autoTotalLiabilities =
		balanceSheet.capital +
		balanceSheet.reservesAndSurplus +
		balanceSheet.securedLoans +
		balanceSheet.unsecuredLoans +
		balanceSheet.currentLiabilities;
	const autoTotalRevenue =
		profitLoss.grossRevenue + profitLoss.otherOperatingIncome;
	const autoTotalExpenses =
		profitLoss.purchasesAndDirectExpenses +
		profitLoss.employeeBenefitExpenses +
		profitLoss.depreciation +
		profitLoss.otherExpenses;
	const autoNetProfit = autoTotalRevenue - autoTotalExpenses;

	return (
		<div className="space-y-4">
			<Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
				<Info className="h-4 w-4" />
				<AlertDescription className="text-sm">
					Schedule BP / Balance Sheet / P&L as required for {recommendedForm}.
					These map to Part A-BS, Part A-P&L and Part A-OI.
				</AlertDescription>
			</Alert>

			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-base">Balance Sheet (Part A-BS)</CardTitle>
					<CardDescription>
						Assets and liabilities as on 31st March
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div>
						<h4 className="text-sm font-semibold mb-2 text-green-700 dark:text-green-400">
							Assets
						</h4>
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
							{[
								{
									key: "fixedAssets",
									label: "Fixed Assets (Net of Depreciation)",
								},
								{ key: "investments", label: "Investments" },
								{ key: "currentAssets", label: "Current Assets" },
								{ key: "loansAndAdvances", label: "Loans & Advances" },
								{ key: "otherAssets", label: "Other Assets" },
							].map((item) => (
								<div key={item.key}>
									<Label className="text-xs">{item.label} (₹)</Label>
									<Input
										type="number"
										value={balanceSheet[item.key as keyof BalanceSheet] || ""}
										onChange={(
											e: React.ChangeEvent<HTMLInputElement>,
										): void => {
											const val = Number(e.target.value);
											setBalanceSheet((p: BalanceSheetDetails) => ({
												...p,
												[item.key]: val,
											}));
										}}
									/>
								</div>
							))}
						</div>
						<div className="mt-2 p-2 bg-green-50 dark:bg-green-950 rounded text-sm font-medium">
							Total Assets: ₹{autoTotalAssets.toLocaleString("en-IN")}
						</div>
					</div>
					<Separator />
					<div>
						<h4 className="text-sm font-semibold mb-2 text-red-700 dark:text-red-400">
							Liabilities & Capital
						</h4>
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
							{[
								{ key: "capital", label: "Capital / Share Capital" },
								{ key: "reservesAndSurplus", label: "Reserves & Surplus" },
								{ key: "securedLoans", label: "Secured Loans" },
								{ key: "unsecuredLoans", label: "Unsecured Loans" },
								{
									key: "currentLiabilities",
									label: "Current Liabilities & Provisions",
								},
							].map((item) => (
								<div key={item.key}>
									<Label className="text-xs">{item.label} (₹)</Label>
									<Input
										type="number"
										value={balanceSheet[item.key as keyof BalanceSheet] || ""}
										onChange={(
											e: React.ChangeEvent<HTMLInputElement>,
										): void => {
											const val = Number(e.target.value);
											setBalanceSheet((p: BalanceSheetDetails) => ({
												...p,
												[item.key]: val,
											}));
										}}
									/>
								</div>
							))}
						</div>
						<div className="mt-2 p-2 bg-red-50 dark:bg-red-950 rounded text-sm font-medium">
							Total Liabilities: ₹{autoTotalLiabilities.toLocaleString("en-IN")}
							{autoTotalAssets !== autoTotalLiabilities &&
								autoTotalAssets > 0 && (
									<span className="ml-2 text-red-600 text-xs">
										(Does not tally — difference: ₹
										{Math.abs(
											autoTotalAssets - autoTotalLiabilities,
										).toLocaleString("en-IN")}
										)
									</span>
								)}
						</div>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-base">
						Profit & Loss Account (Part A-P&L)
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					<div>
						<h4 className="text-sm font-semibold mb-2">Revenue</h4>
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
							<div>
								<Label className="text-xs">Gross Revenue / Turnover (₹)</Label>
								<Input
									type="number"
									value={profitLoss.grossRevenue || ""}
									onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
										setProfitLoss((p: ProfitLossDetails) => ({
											...p,
											grossRevenue: Number(e.target.value),
										}))
									}
								/>
							</div>
							<div>
								<Label className="text-xs">Other Operating Income (₹)</Label>
								<Input
									type="number"
									value={profitLoss.otherOperatingIncome || ""}
									onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
										setProfitLoss((p: ProfitLossDetails) => ({
											...p,
											otherOperatingIncome: Number(e.target.value),
										}))
									}
								/>
							</div>
						</div>
						<div className="mt-2 p-2 bg-blue-50 dark:bg-blue-950 rounded text-sm">
							Total Revenue: ₹{autoTotalRevenue.toLocaleString("en-IN")}
						</div>
					</div>
					<Separator />
					<div>
						<h4 className="text-sm font-semibold mb-2">Expenses</h4>
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
							{[
								{
									key: "purchasesAndDirectExpenses",
									label: "Purchases & Direct Expenses",
								},
								{
									key: "employeeBenefitExpenses",
									label: "Employee Benefit Expenses",
								},
								{ key: "depreciation", label: "Depreciation & Amortisation" },
								{ key: "otherExpenses", label: "Other Expenses" },
							].map((item) => (
								<div key={item.key}>
									<Label className="text-xs">{item.label} (₹)</Label>
									<Input
										type="number"
										value={
											profitLoss[item.key as keyof ProfitLossDetails] || ""
										}
										onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
											setProfitLoss((p: ProfitLossDetails) => ({
												...p,
												[item.key]: Number(e.target.value),
											}))
										}
									/>
								</div>
							))}
						</div>
						<div className="mt-2 p-2 bg-amber-50 dark:bg-amber-950 rounded text-sm">
							Total Expenses: ₹{autoTotalExpenses.toLocaleString("en-IN")}
						</div>
					</div>
					<div
						className={`p-3 rounded-lg text-sm font-semibold ${autoNetProfit >= 0 ? "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200" : "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200"}`}
					>
						Net Profit Before Tax: ₹{autoNetProfit.toLocaleString("en-IN")}{" "}
						{autoNetProfit < 0 ? "(Loss)" : ""}
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-base">Depreciation Schedule</CardTitle>
					<CardDescription>
						Block-wise depreciation as per IT Act (WDV method)
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3">
					{depreciationEntries.map((entry: DepreciationEntry, idx: number) => (
						<div key={idx} className="border rounded-lg p-3 space-y-2">
							<div className="flex items-center justify-between">
								<span className="font-medium text-sm">Block {idx + 1}</span>
								<Button
									variant="ghost"
									size="sm"
									onClick={(): void =>
										setDepreciationEntries((prev: DepreciationEntry[]) =>
											prev.filter(
												(_: DepreciationEntry, i: number): boolean => i !== idx,
											),
										)
									}
								>
									<Trash2 className="h-4 w-4 text-destructive" />
								</Button>
							</div>
							<div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
								<div>
									<Label className="text-xs">Asset Block</Label>
									<Input
										value={entry.assetBlock}
										onChange={(
											e: React.ChangeEvent<HTMLInputElement>,
										): void => {
											const updated = [...depreciationEntries];
											updated[idx] = {
												...updated[idx],
												assetBlock: e.target.value,
											};
											setDepreciationEntries(updated);
										}}
										placeholder="e.g. Plant & Machinery"
									/>
								</div>
								<div>
									<Label className="text-xs">Rate %</Label>
									<Input
										type="number"
										value={entry.depreciationRate || ""}
										onChange={(
											e: React.ChangeEvent<HTMLInputElement>,
										): void => {
											const updated = [...depreciationEntries];
											updated[idx] = {
												...updated[idx],
												depreciationRate: Number(e.target.value),
											};
											setDepreciationEntries(updated);
										}}
									/>
								</div>
								<div>
									<Label className="text-xs">Opening WDV (₹)</Label>
									<Input
										type="number"
										value={entry.openingWDV || ""}
										onChange={(
											e: React.ChangeEvent<HTMLInputElement>,
										): void => {
											const updated = [...depreciationEntries];
											updated[idx] = {
												...updated[idx],
												openingWDV: Number(e.target.value),
											};
											setDepreciationEntries(updated);
										}}
									/>
								</div>
								<div>
									<Label className="text-xs">Additions (₹)</Label>
									<Input
										type="number"
										value={entry.additions || ""}
										onChange={(
											e: React.ChangeEvent<HTMLInputElement>,
										): void => {
											const updated = [...depreciationEntries];
											updated[idx] = {
												...updated[idx],
												additions: Number(e.target.value),
											};
											setDepreciationEntries(updated);
										}}
									/>
								</div>
								<div>
									<Label className="text-xs">Deletions (₹)</Label>
									<Input
										type="number"
										value={entry.disposals || ""}
										onChange={(
											e: React.ChangeEvent<HTMLInputElement>,
										): void => {
											const updated = [...depreciationEntries];
											updated[idx] = {
												...updated[idx],
												disposals: Number(e.target.value),
											};
											setDepreciationEntries(updated);
										}}
									/>
								</div>
								<div>
									<Label className="text-xs">Depreciation (₹)</Label>
									<Input
										type="number"
										value={entry.depreciationAmount || ""}
										onChange={(
											e: React.ChangeEvent<HTMLInputElement>,
										): void => {
											const updated = [...depreciationEntries];
											updated[idx] = {
												...updated[idx],
												depreciationAmount: Number(e.target.value),
											};
											setDepreciationEntries(updated);
										}}
									/>
								</div>
								<div>
									<Label className="text-xs">Closing WDV (₹)</Label>
									<div className="text-sm mt-1 font-medium p-2 bg-muted rounded">
										₹
										{(
											entry.openingWDV +
											entry.additions -
											entry.disposals -
											entry.depreciationAmount
										).toLocaleString("en-IN")}
									</div>
								</div>
							</div>
						</div>
					))}
					<Button
						variant="outline"
						size="sm"
						onClick={(): void =>
							setDepreciationEntries((prev: DepreciationEntry[]) => [
								...prev,
								{
									assetBlock: "",
									depreciationRate: 15,
									openingWDV: 0,
									additions: 0,
									disposals: 0,
									depreciationAmount: 0,
									closingWDV: 0,
								},
							])
						}
					>
						<Plus className="h-4 w-4 mr-1" /> Add Depreciation Block
					</Button>
				</CardContent>
			</Card>

			{recommendedForm === "ITR-3" && (
				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-base">
							Tax Audit Information (Section 44AB)
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						<div className="flex items-center gap-2">
							<Checkbox
								checked={taxAuditInfo.isAuditRequired}
								onCheckedChange={(c: boolean): void =>
									setTaxAuditInfo((p: TaxAuditInfo) => ({
										...p,
										isAuditRequired: !!c,
									}))
								}
							/>
							<Label>Tax Audit is required (turnover exceeds threshold)</Label>
						</div>
						{taxAuditInfo.isAuditRequired && (
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pl-6">
								<div>
									<Label className="text-xs">Auditor Name</Label>
									<Input
										value={taxAuditInfo.auditorName}
										onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
											setTaxAuditInfo((p: TaxAuditInfo) => ({
												...p,
												auditorName: e.target.value,
											}))
										}
									/>
								</div>
								<div>
									<Label className="text-xs">Membership Number</Label>
									<Input
										value={taxAuditInfo.auditorMembershipNo}
										onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
											setTaxAuditInfo((p: TaxAuditInfo) => ({
												...p,
												auditorMembershipNo: e.target.value,
											}))
										}
									/>
								</div>
								<div>
									<Label className="text-xs">Audit Date</Label>
									<Input
										type="date"
										value={taxAuditInfo.auditDate}
										onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
											setTaxAuditInfo((p: TaxAuditInfo) => ({
												...p,
												auditDate: e.target.value,
											}))
										}
									/>
								</div>
								<div className="space-y-2">
									<div className="flex items-center gap-2">
										<Checkbox
											checked={taxAuditInfo.form3CA_3CD}
											onCheckedChange={(c: boolean): void =>
												setTaxAuditInfo((p: TaxAuditInfo) => ({
													...p,
													form3CA_3CD: !!c,
													form3CB_3CD: c ? false : p.form3CB_3CD,
												}))
											}
										/>
										<Label className="text-xs">
											Form 3CA-3CD (company/firm audit)
										</Label>
									</div>
									<div className="flex items-center gap-2">
										<Checkbox
											checked={taxAuditInfo.form3CB_3CD}
											onCheckedChange={(c: boolean): void =>
												setTaxAuditInfo((p: TaxAuditInfo) => ({
													...p,
													form3CB_3CD: !!c,
													form3CA_3CD: c ? false : p.form3CA_3CD,
												}))
											}
										/>
										<Label className="text-xs">
											Form 3CB-3CD (other persons audit)
										</Label>
									</div>
								</div>
								<div className="flex items-center gap-2">
									<Checkbox
										checked={taxAuditInfo.auditReportFiled}
										onCheckedChange={(c: boolean): void =>
											setTaxAuditInfo((p: TaxAuditInfo) => ({
												...p,
												auditReportFiled: !!c,
											}))
										}
									/>
									<Label className="text-xs">
										Audit Report Filed on IT Portal
									</Label>
								</div>
							</div>
						)}
					</CardContent>
				</Card>
			)}

			{recommendedForm === "ITR-3" && (
				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-base">
							F&O / Intraday Income (Schedule BP)
						</CardTitle>
						<CardDescription>
							Futures, Options, and Intraday trading classified as business
							income
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
							<div>
								<Label className="text-xs">Futures Gains/Loss (₹)</Label>
								<Input
									type="number"
									value={foIncome.futuresGains || ""}
									onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
										setFoIncome((p: FOIncome) => ({
											...p,
											futuresGains: Number(e.target.value),
										}))
									}
								/>
							</div>
							<div>
								<Label className="text-xs">Options Gains/Loss (₹)</Label>
								<Input
									type="number"
									value={foIncome.optionsGains || ""}
									onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
										setFoIncome((p: FOIncome) => ({
											...p,
											optionsGains: Number(e.target.value),
										}))
									}
								/>
							</div>
							<div>
								<Label className="text-xs">Intraday Gains/Loss (₹)</Label>
								<Input
									type="number"
									value={foIncome.intradayGains || ""}
									onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
										setFoIncome((p: FOIncome) => ({
											...p,
											intradayGains: Number(e.target.value),
										}))
									}
								/>
							</div>
							<div className="flex items-center gap-2 pt-5">
								<Checkbox
									checked={foIncome.isSpeculative}
									onCheckedChange={(c: boolean): void =>
										setFoIncome((p: FOIncome) => ({ ...p, isSpeculative: !!c }))
									}
								/>
								<Label className="text-xs">
									Mark intraday as speculative income (Section 43(5))
								</Label>
							</div>
						</div>
						<div className="mt-3 p-2 bg-muted rounded text-sm">
							Net F&O + Intraday: ₹
							{(
								foIncome.futuresGains +
								foIncome.optionsGains +
								foIncome.intradayGains
							).toLocaleString("en-IN")}
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
};
