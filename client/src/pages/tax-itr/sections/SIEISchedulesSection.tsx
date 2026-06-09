import React from "react";
import { Calculator } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { formatCurrency, FieldHint } from "@/components/tax-itr/TaxITRHelpers";
import { useTax } from "../TaxContext";
import { ScheduleSIDetails, ScheduleEIDetails } from "../types";

export const SIEISchedulesSection: React.FC = (): React.ReactElement => {
	const {
		scheduleSI,
		setScheduleSI,
		scheduleEI,
		setScheduleEI,
		capitalGainsDetails,
		specialRateIncome,
		totals,
	} = useTax();
	const totalSI =
		scheduleSI.stcg111A +
		scheduleSI.ltcg112A +
		scheduleSI.ltcg112 +
		scheduleSI.vdaCrypto115BBH +
		scheduleSI.lottery115BB +
		scheduleSI.horseRacing +
		scheduleSI.onlineGaming +
		scheduleSI.dtaaSpecialRate +
		scheduleSI.otherSpecialRate;
	const totalEI =
		scheduleEI.agriculturalIncome +
		scheduleEI.ltcgExemptUpTo125000 +
		scheduleEI.dividendFromCooperative +
		scheduleEI.ppfInterest +
		scheduleEI.epfInterest +
		scheduleEI.section10Exemptions +
		scheduleEI.otherExemptIncome;

	const autoPopulateSI = (): void => {
		setScheduleSI((prev: ScheduleSIDetails) => ({
			...prev,
			stcg111A: capitalGainsDetails.sttPaidSTCG,
			ltcg112A: Math.max(0, capitalGainsDetails.sttPaidLTCG - 125000),
			vdaCrypto115BBH: prev.vdaCrypto115BBH,
			lottery115BB: specialRateIncome.lottery,
			horseRacing: specialRateIncome.horseRacing,
			onlineGaming: specialRateIncome.onlineGaming,
		}));
	};

	return (
		<div className="space-y-4">
			<Card>
				<CardHeader className="pb-3">
					<div className="flex items-center justify-between">
						<div>
							<CardTitle className="text-base">
								Schedule SI — Income Chargeable at Special Rates
							</CardTitle>
							<CardDescription>
								Income taxed at rates other than normal slab (capital gains,
								lottery, crypto, DTAA rates)
							</CardDescription>
						</div>
						<Button
							variant="outline"
							size="sm"
							onClick={autoPopulateSI}
							data-testid="btn-auto-populate-si"
						>
							<Calculator className="h-3.5 w-3.5 mr-1" /> Auto-fill from CG
						</Button>
					</div>
				</CardHeader>
				<CardContent className="space-y-3">
					<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
						Capital Gains at Special Rates
					</p>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
						<div>
							<Label className="text-xs">
								STCG u/s 111A (₹) — 20%{" "}
								<FieldHint text="Short-term capital gains on listed equity shares/MF where STT paid on sale. Taxed at flat 20%." />
							</Label>
							<Input
								type="number"
								value={scheduleSI.stcg111A || ""}
								onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
									setScheduleSI((p: ScheduleSIDetails) => ({
										...p,
										stcg111A: Number(e.target.value),
									}))
								}
								data-testid="input-si-stcg-111a"
							/>
						</div>
						<div>
							<Label className="text-xs">
								LTCG u/s 112A (₹) — 12.5%{" "}
								<FieldHint text="Long-term capital gains on listed equity/MF with STT, exceeding ₹1.25 lakh exemption. Taxed at 12.5%." />
							</Label>
							<Input
								type="number"
								value={scheduleSI.ltcg112A || ""}
								onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
									setScheduleSI((p: ScheduleSIDetails) => ({
										...p,
										ltcg112A: Number(e.target.value),
									}))
								}
								data-testid="input-si-ltcg-112a"
							/>
						</div>
						<div>
							<Label className="text-xs">
								LTCG u/s 112 (₹) — 20% with indexation{" "}
								<FieldHint text="Long-term capital gains on unlisted shares, property, gold, debt MF (pre-2023 investments). 20% with indexation benefit." />
							</Label>
							<Input
								type="number"
								value={scheduleSI.ltcg112 || ""}
								onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
									setScheduleSI((p: ScheduleSIDetails) => ({
										...p,
										ltcg112: Number(e.target.value),
									}))
								}
								data-testid="input-si-ltcg-112"
							/>
						</div>
						<div>
							<Label className="text-xs">
								VDA / Crypto u/s 115BBH (₹) — 30%{" "}
								<FieldHint text="Virtual Digital Assets (cryptocurrency, NFTs) taxed at flat 30%. No deduction except cost of acquisition. 1% TDS applies." />
							</Label>
							<Input
								type="number"
								value={scheduleSI.vdaCrypto115BBH || ""}
								onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
									setScheduleSI((p: ScheduleSIDetails) => ({
										...p,
										vdaCrypto115BBH: Number(e.target.value),
									}))
								}
								data-testid="input-si-vda"
							/>
						</div>
					</div>
					<Separator />
					<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
						Winnings & Other Special Rate Income
					</p>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
						<div>
							<Label className="text-xs">
								Lottery / Crossword / Game Show u/s 115BB (₹) — 30%
							</Label>
							<Input
								type="number"
								value={scheduleSI.lottery115BB || ""}
								onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
									setScheduleSI((p: ScheduleSIDetails) => ({
										...p,
										lottery115BB: Number(e.target.value),
									}))
								}
							/>
						</div>
						<div>
							<Label className="text-xs">Horse Racing (₹) — 30%</Label>
							<Input
								type="number"
								value={scheduleSI.horseRacing || ""}
								onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
									setScheduleSI((p: ScheduleSIDetails) => ({
										...p,
										horseRacing: Number(e.target.value),
									}))
								}
							/>
						</div>
						<div>
							<Label className="text-xs">Online Gaming (₹) — 30%</Label>
							<Input
								type="number"
								value={scheduleSI.onlineGaming || ""}
								onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
									setScheduleSI((p: ScheduleSIDetails) => ({
										...p,
										onlineGaming: Number(e.target.value),
									}))
								}
							/>
						</div>
					</div>
					<Separator />
					<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
						DTAA Special Rate Income
					</p>
					<div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
						<div>
							<Label className="text-xs">Income Amount (₹)</Label>
							<Input
								type="number"
								value={scheduleSI.dtaaSpecialRate || ""}
								onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
									setScheduleSI((p: ScheduleSIDetails) => ({
										...p,
										dtaaSpecialRate: Number(e.target.value),
									}))
								}
							/>
						</div>
						<div>
							<Label className="text-xs">DTAA Tax Rate (%)</Label>
							<Input
								type="number"
								value={scheduleSI.dtaaSpecialRatePercent || ""}
								onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
									setScheduleSI((p: ScheduleSIDetails) => ({
										...p,
										dtaaSpecialRatePercent: Number(e.target.value),
									}))
								}
								max={100}
							/>
						</div>
						<div>
							<Label className="text-xs">Other Special Rate Income (₹)</Label>
							<Input
								type="number"
								value={scheduleSI.otherSpecialRate || ""}
								onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
									setScheduleSI((p: ScheduleSIDetails) => ({
										...p,
										otherSpecialRate: Number(e.target.value),
									}))
								}
							/>
						</div>
					</div>
					<Card className="bg-muted/50">
						<CardContent className="p-3">
							<div className="flex justify-between items-center">
								<span className="text-sm font-medium">
									Total Special Rate Income
								</span>
								<span className="font-bold text-lg">
									{formatCurrency(totalSI)}
								</span>
							</div>
							<div className="flex justify-between items-center text-xs text-muted-foreground mt-1">
								<span>Estimated Tax on Special Rate Income</span>
								<span>
									{formatCurrency(
										Math.round(
											scheduleSI.stcg111A * 0.2 +
												scheduleSI.ltcg112A * 0.125 +
												scheduleSI.ltcg112 * 0.2 +
												(scheduleSI.vdaCrypto115BBH +
													scheduleSI.lottery115BB +
													scheduleSI.horseRacing +
													scheduleSI.onlineGaming) *
													0.3 +
												scheduleSI.dtaaSpecialRate *
													(scheduleSI.dtaaSpecialRatePercent / 100) +
												scheduleSI.otherSpecialRate *
													(scheduleSI.otherSpecialRatePercent / 100),
										),
									)}
								</span>
							</div>
						</CardContent>
					</Card>
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-base">
						Schedule EI — Exempt Income
					</CardTitle>
					<CardDescription>
						Income not included in total income — must still be reported in the
						ITR
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3">
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
						<div>
							<Label className="text-xs">
								Agricultural Income (₹){" "}
								<FieldHint text="Income from agriculture is exempt u/s 10(1). However, if total income exceeds ₹5 lakh, agricultural income is used to calculate tax on non-agricultural income (partial integration)." />
							</Label>
							<Input
								type="number"
								value={scheduleEI.agriculturalIncome || ""}
								onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
									setScheduleEI((p: ScheduleEIDetails) => ({
										...p,
										agriculturalIncome: Number(e.target.value),
									}))
								}
								data-testid="input-ei-agri"
							/>
						</div>
						<div>
							<Label className="text-xs">
								LTCG Exempt u/s 112A (up to ₹1,25,000){" "}
								<FieldHint text="First ₹1.25 lakh of LTCG on listed equity/MF with STT is exempt from tax. Auto-calculated from Schedule 112A." />
							</Label>
							<Input
								type="number"
								value={scheduleEI.ltcgExemptUpTo125000 || ""}
								onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
									setScheduleEI((p: ScheduleEIDetails) => ({
										...p,
										ltcgExemptUpTo125000: Math.min(
											125000,
											Number(e.target.value),
										),
									}))
								}
								max={125000}
							/>
						</div>
						<div>
							<Label className="text-xs">
								PPF Interest (₹) — Exempt u/s 10(11)
							</Label>
							<Input
								type="number"
								value={scheduleEI.ppfInterest || ""}
								onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
									setScheduleEI((p: ScheduleEIDetails) => ({
										...p,
										ppfInterest: Number(e.target.value),
									}))
								}
							/>
						</div>
						<div>
							<Label className="text-xs">
								EPF Interest (₹) — Exempt portion{" "}
								<FieldHint text="Interest on EPF balance is exempt if withdrawn after 5 years of continuous service." />
							</Label>
							<Input
								type="number"
								value={scheduleEI.epfInterest || ""}
								onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
									setScheduleEI((p: ScheduleEIDetails) => ({
										...p,
										epfInterest: Number(e.target.value),
									}))
								}
							/>
						</div>
						<div>
							<Label className="text-xs">
								Dividend from Cooperative Society (₹) — Exempt u/s 10(34)
							</Label>
							<Input
								type="number"
								value={scheduleEI.dividendFromCooperative || ""}
								onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
									setScheduleEI((p: ScheduleEIDetails) => ({
										...p,
										dividendFromCooperative: Number(e.target.value),
									}))
								}
							/>
						</div>
						<div>
							<Label className="text-xs">
								Section 10 Exemptions (₹){" "}
								<FieldHint text="Other exemptions under section 10: Leave encashment (10(10AA)), gratuity (10(10)), VRS compensation (10(10C)), etc." />
							</Label>
							<Input
								type="number"
								value={scheduleEI.section10Exemptions || ""}
								onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
									setScheduleEI((p: ScheduleEIDetails) => ({
										...p,
										section10Exemptions: Number(e.target.value),
									}))
								}
							/>
						</div>
						<div>
							<Label className="text-xs">Other Exempt Income (₹)</Label>
							<Input
								type="number"
								value={scheduleEI.otherExemptIncome || ""}
								onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
									setScheduleEI((p: ScheduleEIDetails) => ({
										...p,
										otherExemptIncome: Number(e.target.value),
									}))
								}
							/>
						</div>
						<div>
							<Label className="text-xs">
								Description of Other Exempt Income
							</Label>
							<Input
								value={scheduleEI.exemptIncomeDescription}
								onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
									setScheduleEI((p: ScheduleEIDetails) => ({
										...p,
										exemptIncomeDescription: e.target.value,
									}))
								}
								placeholder="e.g. ELSS maturity, SGB redemption"
							/>
						</div>
					</div>
					<Card className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
						<CardContent className="p-3">
							<div className="flex justify-between items-center">
								<span className="text-sm font-medium text-green-700 dark:text-green-300">
									Total Exempt Income
								</span>
								<span className="font-bold text-lg text-green-700 dark:text-green-300">
									{formatCurrency(totalEI)}
								</span>
							</div>
							{scheduleEI.agriculturalIncome > 0 &&
								totals.grossTotalIncome > 500000 && (
									<p className="text-xs text-amber-600 mt-1">
										Agricultural income with total income above ₹5L triggers
										partial integration for tax calculation.
									</p>
								)}
						</CardContent>
					</Card>
				</CardContent>
			</Card>
		</div>
	);
};
