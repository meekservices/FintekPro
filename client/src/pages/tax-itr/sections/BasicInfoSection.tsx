import React from "react";
import { Lock, AlertTriangle, ArrowLeft } from "lucide-react";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
	FieldHint,
	CurrencyInput,
	ValidationBanner,
} from "@/components/tax-itr/TaxITRHelpers";
import { useTax } from "../TaxContext";
import { ASSESSMENT_YEARS } from "../constants";
import {
	ItrUDetails,
	SalaryDetails,
	CapitalGainsDetails,
	OtherIncomeDetails,
	DeductionDetails,
	IncomeSource,
} from "../types";

export const BasicInfoSection: React.FC = (): React.ReactElement => {
	const {
		panContext,
		assessmentYear,
		setAssessmentYear,
		recommendedForm,
		taxRegime,
		setTaxRegime,
		residentialStatus,
		setResidentialStatus,
		filingSection,
		setFilingSection,
		isUpdatedReturn,
		setIsUpdatedReturn,
		itrUDetails,
		setItrUDetails,
		setSalaryDetails,
		setCapitalGainsDetails,
		setOtherIncomeDetails,
		setDeductionDetails,
		validateStep,
		currentStepId,
		toast,
	} = useTax();

	const currentValidation = validateStep(currentStepId);

	return (
		<div className="space-y-6">
			<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
				<div className="space-y-2">
					<Label className="flex items-center gap-1">
						PAN <Lock className="h-3 w-3 text-muted-foreground" />
					</Label>
					<Input
						value={panContext?.pan || "Loading..."}
						disabled
						className="bg-muted font-mono tracking-wider"
						data-testid="input-pan"
					/>
					<p className="text-xs text-muted-foreground">
						Auto-fetched from your profile. Cannot be changed here.
					</p>
				</div>
				<div className="space-y-2">
					<Label className="flex items-center gap-1">
						Name <Lock className="h-3 w-3 text-muted-foreground" />
					</Label>
					<Input
						value={panContext?.name || "Loading..."}
						disabled
						className="bg-muted"
						data-testid="input-name"
					/>
					<p className="text-xs text-muted-foreground">As per PAN records.</p>
				</div>
				<div className="space-y-2">
					<Label className="flex items-center gap-1">
						Entity Type <Lock className="h-3 w-3 text-muted-foreground" />
					</Label>
					<Input
						value={
							panContext?.entityDescription ||
							panContext?.panType?.toUpperCase() ||
							"Individual"
						}
						disabled
						className="bg-muted"
						data-testid="input-entity-type"
					/>
				</div>
				<div className="space-y-2">
					<Label>
						Assessment Year{" "}
						<FieldHint text="The year in which you file taxes for the previous financial year's income. For income earned in FY 2024-25, you file in AY 2025-26." />
					</Label>
					<Select
						value={assessmentYear}
						onValueChange={(v: string): void => setAssessmentYear(v)}
					>
						<SelectTrigger data-testid="select-assessment-year">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{ASSESSMENT_YEARS.map((year) => (
								<SelectItem key={year} value={year}>
									AY {year}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
				<div className="space-y-2">
					<Label>
						Residential Status{" "}
						<FieldHint text="Resident: in India ≥182 days. NRI: outside India. RNOR: Returning NRI or newly resident. ITR-1 is only for Resident Individuals." />
					</Label>
					<Select
						value={residentialStatus}
						onValueChange={(v: "resident" | "nri" | "rnor"): void =>
							setResidentialStatus(v)
						}
					>
						<SelectTrigger data-testid="select-residential-status">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="resident">Resident (ROR)</SelectItem>
							<SelectItem value="nri">Non-Resident (NRI)</SelectItem>
							<SelectItem value="rnor">
								Resident but Not Ordinarily Resident (RNOR)
							</SelectItem>
						</SelectContent>
					</Select>
					{residentialStatus !== "resident" && (
						<p className="text-xs text-amber-600">
							NRI/RNOR cannot file ITR-1. Form will auto-upgrade to ITR-2 or
							higher.
						</p>
					)}
				</div>
				<div className="space-y-2">
					<Label>
						Filing Under Section{" "}
						<FieldHint text="139(1): Original return filed on time. 139(4): Belated return (after due date). 139(5): Revised return (correcting earlier filed return)." />
					</Label>
					<Select
						value={filingSection}
						onValueChange={(v: string): void => setFilingSection(v)}
					>
						<SelectTrigger data-testid="select-filing-section">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="139(1)">139(1) — Original Return</SelectItem>
							<SelectItem value="139(4)">139(4) — Belated Return</SelectItem>
							<SelectItem value="139(5)">139(5) — Revised Return</SelectItem>
						</SelectContent>
					</Select>
				</div>
			</div>

			<div className="space-y-2">
				<Label>
					Tax Regime{" "}
					<FieldHint text="New regime is default from FY 2023-24. Old regime allows more deductions (80C, 80D, HRA etc.). We'll compare both in the review." />
				</Label>
				<RadioGroup
					value={taxRegime}
					onValueChange={(v: "old" | "new"): void => setTaxRegime(v)}
					className="flex gap-6"
					data-testid="radio-tax-regime"
				>
					<div className="flex items-center space-x-2">
						<RadioGroupItem value="new" id="regime-new" />
						<Label htmlFor="regime-new" className="cursor-pointer">
							<span className="font-medium">New Regime</span>
							<span className="text-xs text-muted-foreground ml-1">
								(Default, lower rates)
							</span>
						</Label>
					</div>
					<div className="flex items-center space-x-2">
						<RadioGroupItem value="old" id="regime-old" />
						<Label htmlFor="regime-old" className="cursor-pointer">
							<span className="font-medium">Old Regime</span>
							<span className="text-xs text-muted-foreground ml-1">
								(More deductions)
							</span>
						</Label>
					</div>
				</RadioGroup>
			</div>

			<Separator />

			<div className="space-y-3">
				<div className="flex items-center gap-3">
					<input
						type="checkbox"
						id="itr-u-toggle"
						title="Filing Updated Return (ITR-U)"
						checked={isUpdatedReturn}
						onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
							setIsUpdatedReturn(e.target.checked)
						}
						className="h-4 w-4 rounded border-gray-300"
						data-testid="checkbox-itr-u"
					/>
					<Label htmlFor="itr-u-toggle" className="cursor-pointer">
						<span className="font-medium">Filing Updated Return (ITR-U)</span>
						<span className="text-xs text-muted-foreground ml-1">
							Under Section 139(8A)
						</span>
					</Label>
				</div>
				{isUpdatedReturn && (
					<Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20">
						<CardContent className="p-4 space-y-3">
							<p className="text-xs text-muted-foreground">
								ITR-U allows you to update a previously filed return within 24
								months from the end of the relevant assessment year. Additional
								tax of 25% (within 12 months) or 50% (12-24 months) applies on
								the additional tax payable.
							</p>
							<div className="grid grid-cols-1 md:grid-cols-2 gap-3">
								<div className="space-y-1.5">
									<Label className="text-xs">
										Original Acknowledgment Number{" "}
										<span className="text-red-500">*</span>
									</Label>
									<Input
										value={itrUDetails.originalAckNumber}
										onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
											setItrUDetails((p: ItrUDetails) => ({
												...p,
												originalAckNumber: e.target.value,
											}))
										}
										placeholder="15-digit ack number"
										maxLength={15}
										className="font-mono"
										data-testid="itr-u-ack"
									/>
								</div>
								<div className="space-y-1.5">
									<Label className="text-xs">Original Filing Date</Label>
									<Input
										type="date"
										value={itrUDetails.originalFilingDate}
										onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
											setItrUDetails((p: ItrUDetails) => ({
												...p,
												originalFilingDate: e.target.value,
											}))
										}
										data-testid="itr-u-date"
									/>
								</div>
								<div className="space-y-1.5">
									<Label className="text-xs">Reason for Updated Return</Label>
									<Select
										value={itrUDetails.reasonForUpdate}
										onValueChange={(v: string): void =>
											setItrUDetails(
												(p: ItrUDetails): ItrUDetails => ({
													...p,
													reasonForUpdate: v,
												}),
											)
										}
									>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="income_not_reported">
												Income not reported earlier
											</SelectItem>
											<SelectItem value="income_incorrectly_reported">
												Income incorrectly reported
											</SelectItem>
											<SelectItem value="wrong_heads">
												Income reported under wrong head
											</SelectItem>
											<SelectItem value="wrong_deductions">
												Wrong deductions claimed
											</SelectItem>
											<SelectItem value="wrong_tax_rate">
												Wrong tax rate applied
											</SelectItem>
											<SelectItem value="wrong_carry_forward">
												Wrong carry forward of loss
											</SelectItem>
											<SelectItem value="wrong_exemption">
												Wrong exemption claimed
											</SelectItem>
											<SelectItem value="other">Others</SelectItem>
										</SelectContent>
									</Select>
								</div>
								<div className="space-y-1.5">
									<Label className="text-xs">Additional Tax Payable (₹)</Label>
									<CurrencyInput
										id="itr-u-tax"
										value={itrUDetails.additionalTaxPayable}
										onChange={(v: number): void =>
											setItrUDetails(
												(p: ItrUDetails): ItrUDetails => ({
													...p,
													additionalTaxPayable: v,
												}),
											)
										}
										placeholder="Additional tax on updated income"
										data-testid="itr-u-tax"
									/>
								</div>
							</div>
							<Alert className="bg-red-50 dark:bg-red-950 border-red-200">
								<AlertTriangle className="h-4 w-4 text-red-500" />
								<AlertDescription className="text-xs">
									<strong>Important:</strong> ITR-U cannot be used to: (a) file
									nil/loss return, (b) claim refund or increase refund, (c)
									decrease total tax liability. Additional tax includes 25%
									surcharge (if filed within 12 months) or 50% (12-24 months).
								</AlertDescription>
							</Alert>
						</CardContent>
					</Card>
				)}
			</div>

			<Separator />
			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-base">Quick Import</CardTitle>
					<CardDescription>
						Import data from IT portal, previous year ITR, or broker statements
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3">
					<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
						<div>
							<Label className="text-xs mb-1 block">
								Import ITR JSON from IT Portal
							</Label>
							<Input
								type="file"
								accept=".json"
								className="text-xs"
								onChange={async (
									e: React.ChangeEvent<HTMLInputElement>,
								): Promise<void> => {
									const file = e.target.files?.[0];
									if (!file) return;
									const formData = new FormData();
									formData.append("file", file);
									try {
										const resp = await fetch("/api/tax/import/itr-json", {
											method: "POST",
											body: formData,
										});
										const result = await resp.json();
										if (result.success) {
											const d = result.data;
											if (d.salary?.grossSalary)
												setSalaryDetails((p: SalaryDetails) => ({
													...p,
													grossSalary: d.salary.grossSalary,
													standardDeduction:
														d.salary.standardDeduction || 75000,
												}));
											if (d.capitalGains?.stcg || d.capitalGains?.ltcg)
												setCapitalGainsDetails((p: CapitalGainsDetails) => ({
													...p,
													shortTermGains: d.capitalGains.stcg,
													longTermGains: d.capitalGains.ltcg,
												}));
											if (d.otherSources?.interestIncome)
												setOtherIncomeDetails((p: OtherIncomeDetails) => ({
													...p,
													interestIncome: d.otherSources.interestIncome,
													dividendIncome: d.otherSources.dividendIncome,
												}));
											if (d.deductions?.section80C)
												setDeductionDetails((p: DeductionDetails) => ({
													...p,
													section80C: d.deductions.section80C,
													section80D: d.deductions.section80D || 0,
												}));
											toast({
												title: "Import Successful",
												description: `Imported ${d.formType} data for AY ${d.assessmentYear || assessmentYear}`,
											});
										} else {
											toast({
												title: "Import Failed",
												description: result.message,
												variant: "destructive",
											});
										}
									} catch {
										toast({
											title: "Import Error",
											description: "Failed to parse ITR JSON",
											variant: "destructive",
										});
									}
								}}
								data-testid="input-import-itr-json"
							/>
						</div>
						<div>
							<Label className="text-xs mb-1 block">
								Import AIS/TIS Statement
							</Label>
							<Input
								type="file"
								accept=".json"
								className="text-xs"
								onChange={async (
									e: React.ChangeEvent<HTMLInputElement>,
								): Promise<void> => {
									const file = e.target.files?.[0];
									if (!file) return;
									const formData = new FormData();
									formData.append("file", file);
									try {
										const resp = await fetch("/api/tax/import/ais-tis", {
											method: "POST",
											body: formData,
										});
										const result = await resp.json();
										if (result.success) {
											const d = result.data;
											if (d.interestIncome > 0)
												setOtherIncomeDetails((p: OtherIncomeDetails) => ({
													...p,
													interestIncome: p.interestIncome + d.interestIncome,
												}));
											if (d.dividendIncome > 0)
												setOtherIncomeDetails((p: OtherIncomeDetails) => ({
													...p,
													dividendIncome: p.dividendIncome + d.dividendIncome,
												}));
											if (d.salaryIncome > 0)
												setSalaryDetails((p: SalaryDetails) => ({
													...p,
													grossSalary: d.salaryIncome,
												}));
											const summary = result.summary;
											toast({
												title: "AIS/TIS Imported",
												description: `${summary.totalTDSEntries} TDS entries, ${summary.totalSFTEntries} SFT entries, ₹${summary.interestIncome.toLocaleString("en-IN")} interest, ₹${summary.dividendIncome.toLocaleString("en-IN")} dividends`,
											});
										} else {
											toast({
												title: "Import Failed",
												description: result.message,
												variant: "destructive",
											});
										}
									} catch {
										toast({
											title: "Import Error",
											description: "Failed to parse AIS/TIS",
											variant: "destructive",
										});
									}
								}}
								data-testid="input-import-ais-tis"
							/>
						</div>
						<div>
							<Label className="text-xs mb-1 block">
								Import Broker CG (23 Brokers)
							</Label>
							<Input
								type="file"
								accept=".csv,.xlsx"
								className="text-xs"
								onChange={async (
									e: React.ChangeEvent<HTMLInputElement>,
								): Promise<void> => {
									const file = e.target.files?.[0];
									if (!file) return;
									const formData = new FormData();
									formData.append("file", file);
									formData.append("broker", "auto");
									try {
										const resp = await fetch("/api/tax/import/broker-cg-v2", {
											method: "POST",
											body: formData,
										});
										const result = await resp.json();
										if (result.success) {
											setCapitalGainsDetails((p: CapitalGainsDetails) => ({
												...p,
												shortTermGains:
													p.shortTermGains + result.data.totalSTCG,
												longTermGains: p.longTermGains + result.data.totalLTCG,
											}));
											toast({
												title: `Broker Import (${result.data.broker})`,
												description: `${result.data.totalTransactions} transactions. STCG: ₹${result.data.totalSTCG.toLocaleString("en-IN")}, LTCG: ₹${result.data.totalLTCG.toLocaleString("en-IN")}`,
											});
										} else {
											toast({
												title: "Import Failed",
												description: result.message,
												variant: "destructive",
											});
										}
									} catch {
										toast({ title: "Import Error", variant: "destructive" });
									}
								}}
								data-testid="input-import-broker-cg-v2"
							/>
							<p className="text-[10px] text-muted-foreground mt-0.5">
								Zerodha, Groww, Upstox, Angel One, ICICI Direct, HDFC Sec,
								Motilal, Kotak, 5Paisa, Paytm Money, Axis, Edelweiss, Sharekhan,
								SBI, Dhan, mStock, IIFL, Geojit, Kuvera, CAMS, KFintech, Coin,
								MFCentral
							</p>
						</div>
					</div>
				</CardContent>
			</Card>

			<ValidationBanner validation={currentValidation} />
		</div>
	);
};
