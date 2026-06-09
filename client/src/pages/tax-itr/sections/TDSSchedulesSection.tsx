import React from "react";
import { Info, Calculator, XCircle, Plus } from "lucide-react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { CurrencyInput } from "@/components/tax-itr/TaxITRHelpers";
import { useTax } from "../TaxContext";
import {
	TDS1Entry,
	TDS2Entry,
	TCSEntry,
	Section234FDetails,
	Section87ADetails,
} from "../types";

export const TDSSchedulesSection: React.FC = (): React.ReactElement => {
	const {
		tds1Entries,
		setTds1Entries,
		tds2Entries,
		setTds2Entries,
		tcsEntries,
		setTcsEntries,
		section234F,
		setSection234F,
		section87A,
		setSection87A,
		taxRegime,
		residentialStatus,
	} = useTax();
	const totalTDS1 = tds1Entries.reduce(
		(acc: number, curr: TDS1Entry): number => acc + (curr.tdsDeducted || 0),
		0,
	);
	const totalTDS2 = tds2Entries.reduce(
		(acc: number, curr: TDS2Entry): number => acc + (curr.tdsDeducted || 0),
		0,
	);
	const totalTCS = tcsEntries.reduce(
		(acc: number, curr: TCSEntry): number => acc + (curr.tcsCollected || 0),
		0,
	);

	const compute234F = (): void => {
		const isLate = section234F.actualFilingDate > section234F.filingDueDate;
		let fee = 0;
		if (isLate) {
			if (section234F.totalIncome > 0) {
				fee = section234F.totalIncome > 500000 ? 5000 : 1000;
			}
		}
		setSection234F(
			(p: Section234FDetails): Section234FDetails => ({
				...p,
				isApplicable: isLate,
				lateFee: fee,
				isSmallTaxpayer: section234F.totalIncome <= 500000,
			}),
		);
	};

	const compute87A = (): void => {
		const threshold =
			taxRegime === "old"
				? section87A.incomeThresholdOld
				: section87A.incomeThresholdNew;
		const isElig =
			section87A.taxableIncome <= threshold && residentialStatus === "resident";
		let rebate = 0;
		if (isElig) {
			const maxRebate =
				taxRegime === "old"
					? section87A.maxRebateOldRegime
					: section87A.maxRebateNewRegime;
			rebate = Math.min(section87A.normalTaxLiability, maxRebate);
		}
		setSection87A(
			(p: Section87ADetails): Section87ADetails => ({
				...p,
				isEligible: isElig,
				rebateAmount: rebate,
				taxAfterRebate: Math.max(0, p.normalTaxLiability - rebate),
			}),
		);
	};

	return (
		<div className="space-y-4">
			<Tabs defaultValue="tds1" className="w-full">
				<TabsList className="grid grid-cols-5 w-full">
					<TabsTrigger value="tds1" className="text-xs">
						TDS1 (Salary)
					</TabsTrigger>
					<TabsTrigger value="tds2" className="text-xs">
						TDS2 (Other)
					</TabsTrigger>
					<TabsTrigger value="tcs" className="text-xs">
						TCS
					</TabsTrigger>
					<TabsTrigger value="234f" className="text-xs">
						234F Fee
					</TabsTrigger>
					<TabsTrigger value="87a" className="text-xs">
						87A Rebate
					</TabsTrigger>
				</TabsList>
				<TabsContent value="tds1">
					<Card>
						<CardHeader className="pb-3">
							<CardTitle className="text-base">
								Schedule TDS1 — TDS on Salary
							</CardTitle>
							<CardDescription>
								Details of tax deducted at source from salary (as per Form 16)
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							{tds1Entries.length === 0 ? (
								<div className="text-center py-4 text-muted-foreground text-sm">
									No TDS on salary entries. Add from Form 16.
								</div>
							) : (
								tds1Entries.map(
									(entry: TDS1Entry, idx: number): React.ReactElement => (
										<Card key={idx} className="border-dashed">
											<CardContent className="pt-4 space-y-3">
												<div className="flex items-center justify-between">
													<Badge variant="outline" className="text-xs">
														Employer {idx + 1}
													</Badge>
													<Button
														variant="ghost"
														size="sm"
														onClick={(): void =>
															setTds1Entries((prev: TDS1Entry[]) =>
																prev.filter(
																	(_e: TDS1Entry, i: number): boolean =>
																		i !== idx,
																),
															)
														}
													>
														<XCircle className="h-4 w-4 text-red-500" />
													</Button>
												</div>
												<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
													<div>
														<Label className="text-xs">Employer TAN</Label>
														<Input
															value={entry.employerTAN}
															onChange={(
																e: React.ChangeEvent<HTMLInputElement>,
															): void =>
																setTds1Entries((p: TDS1Entry[]) =>
																	p.map(
																		(x: TDS1Entry, i: number): TDS1Entry =>
																			i === idx
																				? {
																						...x,
																						employerTAN:
																							e.target.value.toUpperCase(),
																					}
																				: x,
																	),
																)
															}
															placeholder="AAAA00000A"
															maxLength={10}
														/>
													</div>
													<div>
														<Label className="text-xs">Employer Name</Label>
														<Input
															value={entry.employerName}
															onChange={(
																e: React.ChangeEvent<HTMLInputElement>,
															): void =>
																setTds1Entries((p: TDS1Entry[]) =>
																	p.map(
																		(x: TDS1Entry, i: number): TDS1Entry =>
																			i === idx
																				? { ...x, employerName: e.target.value }
																				: x,
																	),
																)
															}
														/>
													</div>
													<div>
														<Label className="text-xs">
															Income Credited (₹)
														</Label>
														<CurrencyInput
															id={`tds1-income-${idx}`}
															value={entry.incomeCredited}
															onChange={(v: number): void =>
																setTds1Entries((p: TDS1Entry[]) =>
																	p.map(
																		(x: TDS1Entry, i: number): TDS1Entry =>
																			i === idx
																				? { ...x, incomeCredited: v }
																				: x,
																	),
																)
															}
														/>
													</div>
													<div>
														<Label className="text-xs">TDS Deducted (₹)</Label>
														<CurrencyInput
															id={`tds1-tds-${idx}`}
															value={entry.tdsDeducted}
															onChange={(v: number): void =>
																setTds1Entries((p: TDS1Entry[]): TDS1Entry[] =>
																	p.map(
																		(x: TDS1Entry, i: number): TDS1Entry =>
																			i === idx ? { ...x, tdsDeducted: v } : x,
																	),
																)
															}
														/>
													</div>
												</div>
											</CardContent>
										</Card>
									),
								)
							)}
							<Button
								variant="outline"
								size="sm"
								onClick={(): void =>
									setTds1Entries((p: TDS1Entry[]): TDS1Entry[] => [
										...p,
										{
											employerTAN: "",
											employerName: "",
											salaryUnderSection: "17(1)" as const,
											incomeCredited: 0,
											tdsDeducted: 0,
											tdsClaimedCurrentYear: 0,
										},
									])
								}
							>
								<Plus className="h-3.5 w-3.5 mr-1" /> Add Employer TDS
							</Button>
							{tds1Entries.length > 0 && (
								<div className="bg-muted/50 rounded-lg p-3 text-sm font-semibold flex justify-between">
									<span>Total TDS on Salary</span>
									<span>₹{totalTDS1.toLocaleString("en-IN")}</span>
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>
				<TabsContent value="tds2">
					<Card>
						<CardHeader className="pb-3">
							<CardTitle className="text-base">
								Schedule TDS2 — TDS on Income other than Salary
							</CardTitle>
							<CardDescription>
								Details of tax deducted on interest, rent, professional fees,
								etc. (as per Form 26AS)
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							{tds2Entries.length === 0 ? (
								<div className="text-center py-4 text-muted-foreground text-sm">
									No TDS entries. Add from Form 26AS.
								</div>
							) : (
								tds2Entries.map(
									(entry: TDS2Entry, idx: number): React.ReactElement => (
										<Card key={idx} className="border-dashed">
											<CardContent className="pt-4 space-y-3">
												<div className="flex items-center justify-between">
													<Badge variant="outline" className="text-xs">
														Entry {idx + 1}
													</Badge>
													<Button
														variant="ghost"
														size="sm"
														onClick={(): void =>
															setTds2Entries((prev: TDS2Entry[]): TDS2Entry[] =>
																prev.filter(
																	(_: TDS2Entry, i: number): boolean =>
																		i !== idx,
																),
															)
														}
													>
														<XCircle className="h-4 w-4 text-red-500" />
													</Button>
												</div>
												<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
													<div>
														<Label className="text-xs">Deductor TAN</Label>
														<Input
															value={entry.deductorTAN}
															onChange={(
																e: React.ChangeEvent<HTMLInputElement>,
															): void =>
																setTds2Entries((p: TDS2Entry[]): TDS2Entry[] =>
																	p.map(
																		(x: TDS2Entry, i: number): TDS2Entry =>
																			i === idx
																				? {
																						...x,
																						deductorTAN:
																							e.target.value.toUpperCase(),
																					}
																				: x,
																	),
																)
															}
															placeholder="AAAA00000A"
															maxLength={10}
														/>
													</div>
													<div>
														<Label className="text-xs">Deductor Name</Label>
														<Input
															value={entry.deductorName}
															onChange={(
																e: React.ChangeEvent<HTMLInputElement>,
															): void =>
																setTds2Entries((p: TDS2Entry[]) =>
																	p.map(
																		(x: TDS2Entry, i: number): TDS2Entry =>
																			i === idx
																				? { ...x, deductorName: e.target.value }
																				: x,
																	),
																)
															}
														/>
													</div>
													<div>
														<Label className="text-xs">Income Type</Label>
														<Select
															value={entry.incomeType}
															onValueChange={(
																v:
																	| "interest"
																	| "dividend"
																	| "rent"
																	| "professional_fees"
																	| "commission"
																	| "winnings"
																	| "sale_of_property"
																	| "other",
															): void =>
																setTds2Entries((p: TDS2Entry[]): TDS2Entry[] =>
																	p.map(
																		(x: TDS2Entry, i: number): TDS2Entry =>
																			i === idx ? { ...x, incomeType: v } : x,
																	),
																)
															}
														>
															<SelectTrigger>
																<SelectValue />
															</SelectTrigger>
															<SelectContent>
																<SelectItem value="interest">
																	Interest
																</SelectItem>
																<SelectItem value="dividend">
																	Dividend
																</SelectItem>
																<SelectItem value="rent">Rent</SelectItem>
																<SelectItem value="professional_fees">
																	Professional Fees
																</SelectItem>
																<SelectItem value="commission">
																	Commission / Brokerage
																</SelectItem>
																<SelectItem value="winnings">
																	Winnings (Lottery/Gaming)
																</SelectItem>
																<SelectItem value="sale_of_property">
																	Sale of Property
																</SelectItem>
																<SelectItem value="other">Other</SelectItem>
															</SelectContent>
														</Select>
													</div>
													<div>
														<Label className="text-xs">Section</Label>
														<Input
															value={entry.section}
															onChange={(
																e: React.ChangeEvent<HTMLInputElement>,
															): void =>
																setTds2Entries((p: TDS2Entry[]) =>
																	p.map(
																		(x: TDS2Entry, i: number): TDS2Entry =>
																			i === idx
																				? { ...x, section: e.target.value }
																				: x,
																	),
																)
															}
															placeholder="e.g. 194A"
														/>
													</div>
													<div>
														<Label className="text-xs">
															Income Credited (₹)
														</Label>
														<CurrencyInput
															id={`tds2-income-${idx}`}
															value={entry.incomeCredited}
															onChange={(v: number): void =>
																setTds2Entries((p: TDS2Entry[]) =>
																	p.map(
																		(x: TDS2Entry, i: number): TDS2Entry =>
																			i === idx
																				? { ...x, incomeCredited: v }
																				: x,
																	),
																)
															}
														/>
													</div>
													<div>
														<Label className="text-xs">TDS Deducted (₹)</Label>
														<CurrencyInput
															id={`tds2-tds-${idx}`}
															value={entry.tdsDeducted}
															onChange={(v: number): void =>
																setTds2Entries((p: TDS2Entry[]) =>
																	p.map(
																		(x: TDS2Entry, i: number): TDS2Entry =>
																			i === idx ? { ...x, tdsDeducted: v } : x,
																	),
																)
															}
														/>
													</div>
												</div>
											</CardContent>
										</Card>
									),
								)
							)}
							<Button
								variant="outline"
								size="sm"
								onClick={(): void =>
									setTds2Entries((p: TDS2Entry[]): TDS2Entry[] => [
										...p,
										{
											deductorTAN: "",
											deductorName: "",
											incomeType: "interest" as const,
											section: "194A",
											dateOfPayment: "",
											incomeCredited: 0,
											tdsDeducted: 0,
											tdsClaimedCurrentYear: 0,
										},
									])
								}
							>
								<Plus className="h-3.5 w-3.5 mr-1" /> Add TDS Entry
							</Button>
							{tds2Entries.length > 0 && (
								<div className="bg-muted/50 rounded-lg p-3 text-sm font-semibold flex justify-between">
									<span>Total TDS (Other)</span>
									<span>₹{totalTDS2.toLocaleString("en-IN")}</span>
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>
				<TabsContent value="tcs">
					<Card>
						<CardHeader className="pb-3">
							<CardTitle className="text-base">
								Schedule TCS — Tax Collected at Source
							</CardTitle>
							<CardDescription>
								Details of tax collected at source on purchases (as per Form
								26AS)
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							{tcsEntries.length === 0 ? (
								<div className="text-center py-4 text-muted-foreground text-sm">
									No TCS entries.
								</div>
							) : (
								tcsEntries.map((entry: TCSEntry, idx: number) => (
									<Card key={idx} className="border-dashed">
										<CardContent className="pt-4 space-y-3">
											<div className="flex items-center justify-between">
												<Badge variant="outline" className="text-xs">
													TCS {idx + 1}
												</Badge>
												<Button
													variant="ghost"
													size="sm"
													onClick={(): void =>
														setTcsEntries((prev: TCSEntry[]): TCSEntry[] =>
															prev.filter(
																(_: TCSEntry, i: number): boolean => i !== idx,
															),
														)
													}
												>
													<XCircle className="h-4 w-4 text-red-500" />
												</Button>
											</div>
											<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
												<div>
													<Label className="text-xs">Collector TAN</Label>
													<Input
														value={entry.collectorTAN}
														onChange={(
															e: React.ChangeEvent<HTMLInputElement>,
														): void =>
															setTcsEntries((p: TCSEntry[]): TCSEntry[] =>
																p.map(
																	(x: TCSEntry, i: number): TCSEntry =>
																		i === idx
																			? {
																					...x,
																					collectorTAN:
																						e.target.value.toUpperCase(),
																				}
																			: x,
																),
															)
														}
													/>
												</div>
												<div>
													<Label className="text-xs">Collector Name</Label>
													<Input
														value={entry.collectorName}
														onChange={(
															e: React.ChangeEvent<HTMLInputElement>,
														): void =>
															setTcsEntries((p: TCSEntry[]) =>
																p.map(
																	(x: TCSEntry, i: number): TCSEntry =>
																		i === idx
																			? { ...x, collectorName: e.target.value }
																			: x,
																),
															)
														}
													/>
												</div>
												<div>
													<Label className="text-xs">Amount Paid (₹)</Label>
													<CurrencyInput
														id={`tcs-amt-${idx}`}
														value={entry.amountPaid}
														onChange={(v: number): void =>
															setTcsEntries((p: TCSEntry[]) =>
																p.map(
																	(x: TCSEntry, i: number): TCSEntry =>
																		i === idx ? { ...x, amountPaid: v } : x,
																),
															)
														}
													/>
												</div>
												<div>
													<Label className="text-xs">TCS Collected (₹)</Label>
													<CurrencyInput
														id={`tcs-tcs-${idx}`}
														value={entry.tcsCollected}
														onChange={(v: number): void =>
															setTcsEntries((p: TCSEntry[]) =>
																p.map(
																	(x: TCSEntry, i: number): TCSEntry =>
																		i === idx ? { ...x, tcsCollected: v } : x,
																),
															)
														}
													/>
												</div>
											</div>
										</CardContent>
									</Card>
								))
							)}
							<Button
								variant="outline"
								size="sm"
								onClick={(): void =>
									setTcsEntries((p: TCSEntry[]): TCSEntry[] => [
										...p,
										{
											collectorTAN: "",
											collectorName: "",
											amountPaid: 0,
											tcsCollected: 0,
											tcsClaimedCurrentYear: 0,
										},
									])
								}
							>
								<Plus className="h-3.5 w-3.5 mr-1" /> Add TCS Entry
							</Button>
							{tcsEntries.length > 0 && (
								<div className="bg-muted/50 rounded-lg p-3 text-sm font-semibold flex justify-between">
									<span>Total TCS</span>
									<span>₹{totalTCS.toLocaleString("en-IN")}</span>
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>
				<TabsContent value="234f">
					<Card>
						<CardHeader className="pb-3">
							<CardTitle className="text-base">
								Section 234F — Late Filing Fee
							</CardTitle>
							<CardDescription>
								Fee for filing return after the due date under Section 139(1)
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200">
								<Info className="h-4 w-4" />
								<AlertDescription className="text-xs">
									Late filing fee: ₹5,000 if total income exceeds ₹5 lakhs,
									₹1,000 if total income is up to ₹5 lakhs. No fee if return is
									filed before due date.
								</AlertDescription>
							</Alert>
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
								<div>
									<Label className="text-xs">Due Date of Filing</Label>
									<Input
										type="date"
										value={section234F.filingDueDate}
										onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
											setSection234F((p: Section234FDetails) => ({
												...p,
												filingDueDate: e.target.value,
											}))
										}
									/>
								</div>
								<div>
									<Label className="text-xs">Actual Filing Date</Label>
									<Input
										type="date"
										value={section234F.actualFilingDate}
										onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
											setSection234F((p: Section234FDetails) => ({
												...p,
												actualFilingDate: e.target.value,
											}))
										}
									/>
								</div>
								<div>
									<Label className="text-xs">Total Income (₹)</Label>
									<CurrencyInput
										id="s234f-income"
										value={section234F.totalIncome}
										onChange={(v: number): void =>
											setSection234F((p: Section234FDetails) => ({
												...p,
												totalIncome: v,
											}))
										}
									/>
								</div>
							</div>
							<Button
								onClick={compute234F}
								className="w-full"
								data-testid="btn-compute-234f"
							>
								<Calculator className="h-4 w-4 mr-2" /> Compute Late Fee
							</Button>
							{section234F.isApplicable && (
								<div className="bg-red-50 dark:bg-red-950 rounded-lg p-3 text-sm space-y-1">
									<div className="flex justify-between font-semibold text-red-700 dark:text-red-300">
										<span>Late Filing Fee u/s 234F</span>
										<span>₹{section234F.lateFee.toLocaleString("en-IN")}</span>
									</div>
									<p className="text-xs text-red-600 dark:text-red-400">
										{section234F.isSmallTaxpayer
											? "Reduced fee (income ≤ ₹5 lakhs)"
											: "Standard fee (income > ₹5 lakhs)"}
									</p>
								</div>
							)}
							{section234F.actualFilingDate &&
								!section234F.isApplicable &&
								section234F.lateFee === 0 && (
									<div className="bg-green-50 dark:bg-green-950 rounded-lg p-3 text-sm text-green-700 dark:text-green-300 font-semibold">
										Filed within due date — No late fee applicable
									</div>
								)}
						</CardContent>
					</Card>
				</TabsContent>
				<TabsContent value="87a">
					<Card>
						<CardHeader className="pb-3">
							<CardTitle className="text-base">
								Section 87A — Rebate for Resident Individuals
							</CardTitle>
							<CardDescription>
								Tax rebate for resident individuals with taxable income below
								threshold
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200">
								<Info className="h-4 w-4" />
								<AlertDescription className="text-xs">
									Old Regime: Rebate up to ₹12,500 if taxable income ≤
									₹5,00,000. New Regime: Rebate up to ₹25,000 if taxable income
									≤ ₹7,00,000. Available only for Resident Individuals.
								</AlertDescription>
							</Alert>
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
								<div>
									<Label className="text-xs">Taxable Income (₹)</Label>
									<CurrencyInput
										id="s87a-income"
										value={section87A.taxableIncome}
										onChange={(v: number): void =>
											setSection87A((p: Section87ADetails) => ({
												...p,
												taxableIncome: v,
											}))
										}
									/>
								</div>
								<div>
									<Label className="text-xs">Normal Tax Liability (₹)</Label>
									<CurrencyInput
										id="s87a-tax"
										value={section87A.normalTaxLiability}
										onChange={(v: number): void =>
											setSection87A((p: Section87ADetails) => ({
												...p,
												normalTaxLiability: v,
											}))
										}
									/>
								</div>
							</div>
							<div className="text-xs text-muted-foreground">
								Current Regime:{" "}
								<Badge variant="outline" className="text-xs">
									{taxRegime === "old" ? "Old Regime" : "New Regime"}
								</Badge>{" "}
								| Threshold: ₹
								{(taxRegime === "old"
									? section87A.incomeThresholdOld
									: section87A.incomeThresholdNew
								).toLocaleString("en-IN")}{" "}
								| Max Rebate: ₹
								{(taxRegime === "old"
									? section87A.maxRebateOldRegime
									: section87A.maxRebateNewRegime
								).toLocaleString("en-IN")}
							</div>
							<Button
								onClick={compute87A}
								className="w-full"
								data-testid="btn-compute-87a"
							>
								<Calculator className="h-4 w-4 mr-2" /> Check Eligibility &
								Compute Rebate
							</Button>
							{section87A.isEligible && (
								<div className="bg-green-50 dark:bg-green-950 rounded-lg p-3 text-sm space-y-1">
									<div className="flex justify-between font-semibold text-green-700 dark:text-green-300">
										<span>Rebate u/s 87A</span>
										<span>
											₹{section87A.rebateAmount.toLocaleString("en-IN")}
										</span>
									</div>
									<div className="flex justify-between text-xs">
										<span>Tax After Rebate</span>
										<span>
											₹{section87A.taxAfterRebate.toLocaleString("en-IN")}
										</span>
									</div>
								</div>
							)}
							{!section87A.isEligible && section87A.taxableIncome > 0 && (
								<div className="bg-amber-50 dark:bg-amber-950 rounded-lg p-3 text-sm text-amber-700 dark:text-amber-300">
									{residentialStatus !== "resident"
										? "Rebate u/s 87A is available only to Resident Individuals"
										: `Taxable income exceeds threshold — Rebate not available`}
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
};
