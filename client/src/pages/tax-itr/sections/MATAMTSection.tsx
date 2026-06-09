import React from "react";
import { Calculator, XCircle, Plus } from "lucide-react";
import {
	Card,
	CardHeader,
	CardTitle,
	CardDescription,
	CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { CurrencyInput } from "@/components/tax-itr/TaxITRHelpers";
import { useTax } from "../TaxContext";
import {
	MATDetails,
	MATCreditDetails,
	MATCreditEntry,
	AMTDetails,
	AMTCreditDetails,
	AMTCreditEntry,
} from "../types";

export const MATAMTSection: React.FC = (): React.ReactElement => {
	const {
		recommendedForm,
		matDetails,
		setMatDetails,
		matcDetails,
		setMatcDetails,
		amtDetails,
		setAmtDetails,
		amtcDetails,
		setAmtcDetails,
	} = useTax();
	const computeMAT = (): void => {
		const additions = Object.values(matDetails.additionsToBookProfit).reduce(
			(s: number, v: number) => s + v,
			0,
		);
		const deductions = Object.values(
			matDetails.deductionsFromBookProfit,
		).reduce((s: number, v: number) => s + v, 0);
		const adjustedBookProfit =
			matDetails.bookProfitBeforeAdjustments + additions - deductions;
		const matTax = Math.round((adjustedBookProfit * matDetails.matRate) / 100);
		const surcharge =
			adjustedBookProfit > 10000000 ? Math.round(matTax * 0.07) : 0;
		const cess = Math.round((matTax + surcharge) * 0.04);
		const totalMAT = matTax + surcharge + cess;
		const isMATApplicable = totalMAT > matDetails.normalTaxLiability;
		setMatDetails((p: MATDetails) => ({
			...p,
			adjustedBookProfit,
			matTaxAmount: matTax,
			surchargeOnMAT: surcharge,
			cessOnMAT: cess,
			totalMATLiability: totalMAT,
			isMATApplicable,
			taxPayableHigherOfMATOrNormal: Math.max(totalMAT, p.normalTaxLiability),
		}));
	};

	const computeAMT = (): void => {
		const totalAdditions = Object.values(amtDetails.additions).reduce(
			(s: number, v: number) => s + v,
			0,
		);
		const adjustedTotalIncome = amtDetails.adjustedTotalIncome + totalAdditions;
		const amtAmount = Math.round(
			(adjustedTotalIncome * amtDetails.amtRate) / 100,
		);
		const surcharge =
			adjustedTotalIncome > 5000000 ? Math.round(amtAmount * 0.1) : 0;
		const cess = Math.round((amtAmount + surcharge) * 0.04);
		const totalAMT = amtAmount + surcharge + cess;
		const isAMTApplicable = totalAMT > amtDetails.normalTaxLiability;
		setAmtDetails((p: AMTDetails) => ({
			...p,
			totalAdjustedIncome: adjustedTotalIncome,
			amtAmount,
			surchargeOnAMT: surcharge,
			cessOnAMT: cess,
			totalAMTLiability: totalAMT,
			isAMTApplicable,
			taxPayableHigherOfMATOrNormal: Math.max(totalAMT, p.normalTaxLiability),
		}));
	};

	return (
		<div className="space-y-4">
			<Tabs defaultValue="mat" className="w-full">
				<TabsList className="grid grid-cols-4 w-full">
					<TabsTrigger value="mat" className="text-xs">
						MAT (115JB)
					</TabsTrigger>
					<TabsTrigger value="matc" className="text-xs">
						MAT Credit
					</TabsTrigger>
					<TabsTrigger value="amt" className="text-xs">
						AMT (115JC)
					</TabsTrigger>
					<TabsTrigger value="amtc" className="text-xs">
						AMT Credit
					</TabsTrigger>
				</TabsList>
				<TabsContent value="mat">
					<Card>
						<CardHeader className="pb-3">
							<CardTitle className="text-base">
								MAT Computation — Section 115JB
							</CardTitle>
							<CardDescription>
								Minimum Alternate Tax applicable to companies when normal tax is
								less than 15% of book profit
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="flex items-center gap-3">
								<Switch
									checked={matDetails.isApplicable}
									onCheckedChange={(v: boolean): void =>
										setMatDetails(
											(p: MATDetails): MATDetails => ({
												...p,
												isApplicable: v,
											}),
										)
									}
								/>
								<Label className="text-sm">
									MAT is applicable (Company filing ITR-6)
								</Label>
							</div>
							{matDetails.isApplicable && (
								<>
									<div>
										<Label className="text-xs">
											Net Profit as per P&L (Book Profit before adjustments) (₹)
										</Label>
										<CurrencyInput
											id="mat-book-profit"
											value={matDetails.bookProfitBeforeAdjustments}
											onChange={(v: number): void =>
												setMatDetails(
													(p: MATDetails): MATDetails => ({
														...p,
														bookProfitBeforeAdjustments: v,
													}),
												)
											}
										/>
									</div>
									<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
										Additions to Book Profit
									</p>
									<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
										{(
											[
												["incomeTaxProvision", "Income Tax Provision"],
												["deferredTax", "Deferred Tax (if debited)"],
												["dividendPaid", "Dividend Paid/Proposed"],
												["carriedForwardLosses", "Carried Forward Losses"],
												["unabsorbedDepreciation", "Unabsorbed Depreciation"],
												["transferToReserve", "Transfer to Reserve"],
												["provisionForDiminution", "Provision for Diminution"],
												[
													"expenditureRelatingExemptIncome",
													"Expenditure on Exempt Income",
												],
												["notionalGain", "Notional Gain on Transfer"],
												["otherAdditions", "Other Additions"],
											] as const
										).map(([key, label]) => (
											<div key={key}>
												<Label className="text-xs">{label} (₹)</Label>
												<CurrencyInput
													id={`mat-add-${key}`}
													value={matDetails.additionsToBookProfit[key]}
													onChange={(v: number): void =>
														setMatDetails(
															(p: MATDetails): MATDetails => ({
																...p,
																additionsToBookProfit: {
																	...p.additionsToBookProfit,
																	[key]: v,
																},
															}),
														)
													}
												/>
											</div>
										))}
									</div>
									<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
										Deductions from Book Profit
									</p>
									<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
										{(
											[
												["withdrawalFromReserve", "Withdrawal from Reserve"],
												["incomeExemptUs10", "Income Exempt u/s 10"],
												["incomeExemptUs11_12", "Income Exempt u/s 11/12"],
												[
													"depreciationExcludingRevaluation",
													"Depreciation (excl. revaluation)",
												],
												[
													"withdrawalFromProvision",
													"Withdrawal from Provision",
												],
												[
													"lowerOfUnabsorbedDepOrBroughtForwardLoss",
													"Lower of Unabsorbed Dep / BF Loss",
												],
												["notionalLoss", "Notional Loss on Transfer"],
												["otherDeductions", "Other Deductions"],
											] as const
										).map(([key, label]) => (
											<div key={key}>
												<Label className="text-xs">{label} (₹)</Label>
												<CurrencyInput
													id={`mat-ded-${key}`}
													value={matDetails.deductionsFromBookProfit[key]}
													onChange={(v: number): void =>
														setMatDetails(
															(p: MATDetails): MATDetails => ({
																...p,
																deductionsFromBookProfit: {
																	...p.deductionsFromBookProfit,
																	[key]: v,
																},
															}),
														)
													}
												/>
											</div>
										))}
									</div>
									<div className="grid grid-cols-2 gap-3">
										<div>
											<Label className="text-xs">
												Normal Tax Liability (₹)
											</Label>
											<CurrencyInput
												id="mat-normal-tax"
												value={matDetails.normalTaxLiability}
												onChange={(v: number): void =>
													setMatDetails(
														(p: MATDetails): MATDetails => ({
															...p,
															normalTaxLiability: v,
														}),
													)
												}
											/>
										</div>
										<div>
											<Label className="text-xs">MAT Rate (%)</Label>
											<Input
												type="number"
												value={matDetails.matRate}
												onChange={(
													e: React.ChangeEvent<HTMLInputElement>,
												): void =>
													setMatDetails(
														(p: MATDetails): MATDetails => ({
															...p,
															matRate: Number(e.target.value),
														}),
													)
												}
											/>
										</div>
									</div>
									<Button
										onClick={computeMAT}
										className="w-full"
										data-testid="btn-compute-mat"
									>
										<Calculator className="h-4 w-4 mr-2" /> Compute MAT
									</Button>
									{matDetails.adjustedBookProfit > 0 && (
										<div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
											<div className="flex justify-between">
												<span>Adjusted Book Profit</span>
												<span>
													₹
													{matDetails.adjustedBookProfit.toLocaleString(
														"en-IN",
													)}
												</span>
											</div>
											<div className="flex justify-between">
												<span>MAT @ {matDetails.matRate}%</span>
												<span>
													₹{matDetails.matTaxAmount.toLocaleString("en-IN")}
												</span>
											</div>
											<div className="flex justify-between">
												<span>Surcharge</span>
												<span>
													₹{matDetails.surchargeOnMAT.toLocaleString("en-IN")}
												</span>
											</div>
											<div className="flex justify-between">
												<span>Health & Education Cess (4%)</span>
												<span>
													₹{matDetails.cessOnMAT.toLocaleString("en-IN")}
												</span>
											</div>
											<div className="flex justify-between font-semibold border-t pt-1">
												<span>Total MAT Liability</span>
												<span>
													₹
													{matDetails.totalMATLiability.toLocaleString("en-IN")}
												</span>
											</div>
											<div className="flex justify-between">
												<span>Normal Tax Liability</span>
												<span>
													₹
													{matDetails.normalTaxLiability.toLocaleString(
														"en-IN",
													)}
												</span>
											</div>
											<div
												className={`flex justify-between font-bold ${matDetails.isMATApplicable ? "text-red-600" : "text-green-600"}`}
											>
												<span>
													{matDetails.isMATApplicable
														? "MAT Applicable — Higher"
														: "Normal Tax Applicable"}
												</span>
												<span>
													₹
													{matDetails.taxPayableHigherOfMATOrNormal.toLocaleString(
														"en-IN",
													)}
												</span>
											</div>
										</div>
									)}
								</>
							)}
						</CardContent>
					</Card>
				</TabsContent>
				<TabsContent value="matc">
					<Card>
						<CardHeader className="pb-3">
							<CardTitle className="text-base">
								MAT Credit — Section 115JAA
							</CardTitle>
							<CardDescription>
								MAT credit can be carried forward for up to 15 years and set off
								against normal tax liability
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="flex items-center gap-3">
								<Switch
									checked={matcDetails.isApplicable}
									onCheckedChange={(v: boolean): void =>
										setMatcDetails(
											(p: MATCreditDetails): MATCreditDetails => ({
												...p,
												isApplicable: v,
											}),
										)
									}
								/>
								<Label className="text-sm">I have MAT credit to claim</Label>
							</div>
							{matcDetails.isApplicable && (
								<>
									{matcDetails.creditEntries.map(
										(
											entry: MATCreditEntry,
											idx: number,
										): React.ReactElement => (
											<Card key={idx} className="border-dashed">
												<CardContent className="pt-4 space-y-3">
													<div className="flex items-center justify-between">
														<Badge variant="outline" className="text-xs">
															AY {entry.assessmentYear}
														</Badge>
														<Button
															variant="ghost"
															size="sm"
															onClick={(): void =>
																setMatcDetails(
																	(p: MATCreditDetails): MATCreditDetails => ({
																		...p,
																		creditEntries: p.creditEntries.filter(
																			(_: MATCreditEntry, i: number) =>
																				i !== idx,
																		),
																	}),
																)
															}
														>
															<XCircle className="h-4 w-4 text-red-500" />
														</Button>
													</div>
													<div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
														<div>
															<Input
																value={entry.assessmentYear}
																onChange={(
																	e: React.ChangeEvent<HTMLInputElement>,
																): void =>
																	setMatcDetails(
																		(
																			p: MATCreditDetails,
																		): MATCreditDetails => ({
																			...p,
																			creditEntries: p.creditEntries.map(
																				(
																					c: MATCreditEntry,
																					i: number,
																				): MATCreditEntry =>
																					i === idx
																						? {
																								...c,
																								assessmentYear: e.target.value,
																							}
																						: c,
																			),
																		}),
																	)
																}
																placeholder="20XX-XX"
															/>
														</div>
														<div>
															<Label className="text-xs">MAT Paid (₹)</Label>
															<CurrencyInput
																id={`matc-paid-${idx}`}
																value={entry.matPaid}
																onChange={(v: number): void =>
																	setMatcDetails(
																		(
																			p: MATCreditDetails,
																		): MATCreditDetails => ({
																			...p,
																			creditEntries: p.creditEntries.map(
																				(c: MATCreditEntry, i: number) =>
																					i === idx ? { ...c, matPaid: v } : c,
																			),
																		}),
																	)
																}
															/>
														</div>
														<div>
															<Label className="text-xs">Normal Tax (₹)</Label>
															<CurrencyInput
																id={`matc-normal-${idx}`}
																value={entry.normalTaxPayable}
																onChange={(v: number): void =>
																	setMatcDetails(
																		(
																			p: MATCreditDetails,
																		): MATCreditDetails => ({
																			...p,
																			creditEntries: p.creditEntries.map(
																				(c: MATCreditEntry, i: number) =>
																					i === idx
																						? {
																								...c,
																								normalTaxPayable: v,
																								matCreditAvailable: Math.max(
																									0,
																									(entry.matPaid || 0) - v,
																								),
																							}
																						: c,
																			),
																		}),
																	)
																}
															/>
														</div>
														<div>
															<Label className="text-xs">
																Credit Available (₹)
															</Label>
															<Input
																type="number"
																value={entry.matCreditAvailable}
																disabled
																className="bg-muted"
															/>
														</div>
														<div>
															<Label className="text-xs">
																Credit Utilized (₹)
															</Label>
															<CurrencyInput
																id={`matc-util-${idx}`}
																value={entry.matCreditUtilized}
																onChange={(v: number): void =>
																	setMatcDetails(
																		(
																			p: MATCreditDetails,
																		): MATCreditDetails => ({
																			...p,
																			creditEntries: p.creditEntries.map(
																				(c: MATCreditEntry, i: number) =>
																					i === idx
																						? { ...c, matCreditUtilized: v }
																						: c,
																			),
																		}),
																	)
																}
															/>
														</div>
													</div>
												</CardContent>
											</Card>
										),
									)}
									<Button
										variant="outline"
										size="sm"
										onClick={(): void =>
											setMatcDetails(
												(p: MATCreditDetails): MATCreditDetails => ({
													...p,
													creditEntries: [
														...p.creditEntries,
														{
															assessmentYear: "",
															matPaid: 0,
															normalTaxPayable: 0,
															matCreditAvailable: 0,
															matCreditUtilized: 0,
															matCreditLapsed: false,
															expiryYear: "",
														},
													],
												}),
											)
										}
									>
										<Plus className="h-3.5 w-3.5 mr-1" /> Add MAT Credit Year
									</Button>
								</>
							)}
						</CardContent>
					</Card>
				</TabsContent>
				<TabsContent value="amt">
					<Card>
						<CardHeader className="pb-3">
							<CardTitle className="text-base">
								AMT Computation — Section 115JC
							</CardTitle>
							<CardDescription>
								Alternate Minimum Tax for non-corporate assessees claiming
								certain deductions
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="flex items-center gap-3">
								<Switch
									checked={amtDetails.isApplicable}
									onCheckedChange={(v: boolean): void =>
										setAmtDetails(
											(p: AMTDetails): AMTDetails => ({
												...p,
												isApplicable: v,
											}),
										)
									}
								/>
								<Label className="text-sm">
									AMT is applicable (Non-corporate with Chapter VI-A deductions)
								</Label>
							</div>
							{amtDetails.isApplicable && (
								<>
									<div>
										<Label className="text-xs">
											Total Income (before Chapter VI-A deductions) (₹)
										</Label>
										<CurrencyInput
											id="amt-adj-income"
											value={amtDetails.adjustedTotalIncome}
											onChange={(v: number): void =>
												setAmtDetails(
													(p: AMTDetails): AMTDetails => ({
														...p,
														adjustedTotalIncome: v,
													}),
												)
											}
										/>
									</div>
									<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
										Additions (Deductions under Chapter VI-A)
									</p>
									<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
										{(
											[
												["deduction80H_80RRB", "Sec 80H to 80RRB"],
												["deduction10AA", "Sec 10AA (SEZ)"],
												["deduction35AD", "Sec 35AD (Specified Business)"],
												["deduction80IA_80IB", "Sec 80IA / 80IB"],
												["deduction80JJA", "Sec 80JJA"],
												["deduction80P", "Sec 80P (Cooperative)"],
												["otherChapter6ADeductions", "Other Chapter VI-A"],
											] as const
										).map(([key, label]) => (
											<div key={key}>
												<Label className="text-xs">{label} (₹)</Label>
												<CurrencyInput
													id={`amt-add-${key}`}
													value={amtDetails.additions[key]}
													onChange={(v: number): void =>
														setAmtDetails(
															(p: AMTDetails): AMTDetails => ({
																...p,
																additions: { ...p.additions, [key]: v },
															}),
														)
													}
												/>
											</div>
										))}
									</div>
									<div className="grid grid-cols-2 gap-3">
										<div>
											<Label className="text-xs">
												Normal Tax Liability (₹)
											</Label>
											<CurrencyInput
												id="amt-normal-tax"
												value={amtDetails.normalTaxLiability}
												onChange={(v: number): void =>
													setAmtDetails(
														(p: AMTDetails): AMTDetails => ({
															...p,
															normalTaxLiability: v,
														}),
													)
												}
											/>
										</div>
										<div>
											<Label className="text-xs">AMT Rate (%)</Label>
											<Input
												type="number"
												value={amtDetails.amtRate}
												onChange={(
													e: React.ChangeEvent<HTMLInputElement>,
												): void =>
													setAmtDetails(
														(p: AMTDetails): AMTDetails => ({
															...p,
															amtRate: Number(e.target.value),
														}),
													)
												}
											/>
										</div>
									</div>
									<Button
										onClick={computeAMT}
										className="w-full"
										data-testid="btn-compute-amt"
									>
										<Calculator className="h-4 w-4 mr-2" /> Compute AMT
									</Button>
									{amtDetails.totalAdjustedIncome > 0 && (
										<div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
											<div className="flex justify-between">
												<span>Adjusted Total Income</span>
												<span>
													₹
													{amtDetails.totalAdjustedIncome.toLocaleString(
														"en-IN",
													)}
												</span>
											</div>
											<div className="flex justify-between">
												<span>AMT @ {amtDetails.amtRate}%</span>
												<span>
													₹{amtDetails.amtAmount.toLocaleString("en-IN")}
												</span>
											</div>
											<div className="flex justify-between">
												<span>Surcharge</span>
												<span>
													₹{amtDetails.surchargeOnAMT.toLocaleString("en-IN")}
												</span>
											</div>
											<div className="flex justify-between">
												<span>H&E Cess (4%)</span>
												<span>
													₹{amtDetails.cessOnAMT.toLocaleString("en-IN")}
												</span>
											</div>
											<div className="flex justify-between font-semibold border-t pt-1">
												<span>Total AMT Liability</span>
												<span>
													₹
													{amtDetails.totalAMTLiability.toLocaleString("en-IN")}
												</span>
											</div>
											<div
												className={`flex justify-between font-bold ${amtDetails.isAMTApplicable ? "text-red-600" : "text-green-600"}`}
											>
												<span>
													{amtDetails.isAMTApplicable
														? "AMT Applicable — Higher"
														: "Normal Tax Applicable"}
												</span>
												<span>
													₹
													{amtDetails.taxPayableHigherOfAMTOrNormal.toLocaleString(
														"en-IN",
													)}
												</span>
											</div>
										</div>
									)}
								</>
							)}
						</CardContent>
					</Card>
				</TabsContent>
				<TabsContent value="amtc">
					<Card>
						<CardHeader className="pb-3">
							<CardTitle className="text-base">
								AMT Credit — Section 115JD
							</CardTitle>
							<CardDescription>
								AMT credit can be carried forward for up to 15 years
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="flex items-center gap-3">
								<Switch
									checked={amtcDetails.isApplicable}
									onCheckedChange={(v: boolean): void =>
										setAmtcDetails(
											(p: AMTCreditDetails): AMTCreditDetails => ({
												...p,
												isApplicable: v,
											}),
										)
									}
								/>
								<Label className="text-sm">I have AMT credit to claim</Label>
							</div>
							{amtcDetails.isApplicable && (
								<>
									{amtcDetails.creditEntries.map(
										(
											entry: AMTCreditEntry,
											idx: number,
										): React.ReactElement => (
											<Card key={idx} className="border-dashed">
												<CardContent className="pt-4 space-y-3">
													<div className="flex items-center justify-between">
														<Badge variant="outline" className="text-xs">
															AY {entry.assessmentYear}
														</Badge>
														<Button
															variant="ghost"
															size="sm"
															onClick={(): void =>
																setAmtcDetails(
																	(p: AMTCreditDetails): AMTCreditDetails => ({
																		...p,
																		creditEntries: p.creditEntries.filter(
																			(_: AMTCreditEntry, i: number) =>
																				i !== idx,
																		),
																	}),
																)
															}
														>
															<XCircle className="h-4 w-4 text-red-500" />
														</Button>
													</div>
													<div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
														<div>
															<Label className="text-xs">Assessment Year</Label>
															<Input
																value={entry.assessmentYear}
																onChange={(
																	e: React.ChangeEvent<HTMLInputElement>,
																): void =>
																	setAmtcDetails(
																		(
																			p: AMTCreditDetails,
																		): AMTCreditDetails => ({
																			...p,
																			creditEntries: p.creditEntries.map(
																				(
																					c: AMTCreditEntry,
																					i: number,
																				): AMTCreditEntry =>
																					i === idx
																						? {
																								...c,
																								assessmentYear: e.target.value,
																							}
																						: c,
																			),
																		}),
																	)
																}
															/>
														</div>
														<div>
															<Label className="text-xs">AMT Paid (₹)</Label>
															<CurrencyInput
																id={`amtc-paid-${idx}`}
																value={entry.amtPaid}
																onChange={(v: number): void =>
																	setAmtcDetails(
																		(
																			p: AMTCreditDetails,
																		): AMTCreditDetails => ({
																			...p,
																			creditEntries: p.creditEntries.map(
																				(c: AMTCreditEntry, i: number) =>
																					i === idx ? { ...c, amtPaid: v } : c,
																			),
																		}),
																	)
																}
															/>
														</div>
														<div>
															<Label className="text-xs">Normal Tax (₹)</Label>
															<CurrencyInput
																id={`amtc-normal-${idx}`}
																value={entry.normalTaxPayable}
																onChange={(v: number): void =>
																	setAmtcDetails(
																		(
																			p: AMTCreditDetails,
																		): AMTCreditDetails => ({
																			...p,
																			creditEntries: p.creditEntries.map(
																				(c: AMTCreditEntry, i: number) =>
																					i === idx
																						? {
																								...c,
																								normalTaxPayable: v,
																								amtCreditAvailable: Math.max(
																									0,
																									(entry.amtPaid || 0) - v,
																								),
																							}
																						: c,
																			),
																		}),
																	)
																}
															/>
														</div>
														<div>
															<Label className="text-xs">
																Credit Available (₹)
															</Label>
															<Input
																type="number"
																value={entry.amtCreditAvailable}
																disabled
																className="bg-muted"
															/>
														</div>
														<div>
															<Label className="text-xs">
																Credit Utilized (₹)
															</Label>
															<CurrencyInput
																id={`amtc-util-${idx}`}
																value={entry.amtCreditUtilized}
																onChange={(v: number): void =>
																	setAmtcDetails(
																		(
																			p: AMTCreditDetails,
																		): AMTCreditDetails => ({
																			...p,
																			creditEntries: p.creditEntries.map(
																				(c: AMTCreditEntry, i: number) =>
																					i === idx
																						? { ...c, amtCreditUtilized: v }
																						: c,
																			),
																		}),
																	)
																}
															/>
														</div>
													</div>
												</CardContent>
											</Card>
										),
									)}
									<Button
										variant="outline"
										size="sm"
										onClick={(): void =>
											setAmtcDetails(
												(p: AMTCreditDetails): AMTCreditDetails => ({
													...p,
													creditEntries: [
														...p.creditEntries,
														{
															assessmentYear: "",
															amtPaid: 0,
															normalTaxPayable: 0,
															amtCreditAvailable: 0,
															amtCreditUtilized: 0,
															amtCreditLapsed: false,
															expiryYear: "",
														},
													],
												}),
											)
										}
									>
										<Plus className="h-3.5 w-3.5 mr-1" /> Add AMT Credit Year
									</Button>
								</>
							)}
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
};
