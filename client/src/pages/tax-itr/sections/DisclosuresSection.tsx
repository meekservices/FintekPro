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
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useTax } from "../TaxContext";
import {
	DirectorshipEntry,
	UnlistedShareEntry,
	LossCarryForward,
	SpecialRateIncome,
	IncomeSource,
} from "../types";

export const DisclosuresSection: React.FC = (): React.ReactElement => {
	const {
		recommendedForm,
		directorships,
		setDirectorships,
		unlistedShares,
		setUnlistedShares,
		lossCarryForward,
		setLossCarryForward,
		specialRateIncome,
		setSpecialRateIncome,
	} = useTax();
	return (
		<div className="space-y-4">
			<Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
				<Info className="h-4 w-4" />
				<AlertDescription className="text-sm">
					Mandatory disclosures for {recommendedForm}: Director positions,
					unlisted equity holdings, and loss carry-forward (Schedule CYLA / BFLA
					/ CFL).
				</AlertDescription>
			</Alert>

			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-base">Directorship in Companies</CardTitle>
					<CardDescription>
						Required if you are/were a director in any company during the FY
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{directorships.map((entry: DirectorshipEntry, idx: number) => (
						<div key={idx} className="border rounded-lg p-3 space-y-3">
							<div className="flex items-center justify-between">
								<span className="font-medium text-xs">Entry {idx + 1}</span>
								<Button
									variant="ghost"
									size="sm"
									onClick={(): void =>
										setDirectorships((prev: DirectorshipEntry[]) =>
											prev.filter(
												(_: DirectorshipEntry, i: number): boolean => i !== idx,
											),
										)
									}
								>
									<Trash2 className="h-4 w-4 text-destructive" />
								</Button>
							</div>
							<div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
								<div>
									<Label className="text-xs">Company Name</Label>
									<Input
										value={entry.companyName}
										onChange={(
											e: React.ChangeEvent<HTMLInputElement>,
										): void => {
											const updated = [...directorships];
											updated[idx] = {
												...updated[idx],
												companyName: e.target.value,
											};
											setDirectorships(updated);
										}}
										placeholder="e.g. ABC Pvt Ltd"
									/>
								</div>
								<div>
									<Label className="text-xs">Company PAN</Label>
									<Input
										value={entry.companyPAN}
										onChange={(
											e: React.ChangeEvent<HTMLInputElement>,
										): void => {
											const updated = [...directorships];
											updated[idx] = {
												...updated[idx],
												companyPAN: e.target.value.toUpperCase(),
											};
											setDirectorships(updated);
										}}
										maxLength={10}
									/>
								</div>
								<div>
									<Label className="text-xs">DIN</Label>
									<Input
										value={entry.din}
										onChange={(
											e: React.ChangeEvent<HTMLInputElement>,
										): void => {
											const updated = [...directorships];
											updated[idx] = { ...updated[idx], din: e.target.value };
											setDirectorships(updated);
										}}
									/>
								</div>
								<div>
									<Label className="text-xs">Shares Held</Label>
									<Input
										type="number"
										value={entry.sharesHeld || ""}
										onChange={(
											e: React.ChangeEvent<HTMLInputElement>,
										): void => {
											const updated = [...directorships];
											updated[idx] = {
												...updated[idx],
												sharesHeld: Number(e.target.value),
											};
											setDirectorships(updated);
										}}
									/>
								</div>
							</div>
						</div>
					))}
					<Button
						variant="outline"
						size="sm"
						onClick={(): void =>
							setDirectorships((prev: DirectorshipEntry[]) => [
								...prev,
								{ companyName: "", companyPAN: "", din: "", sharesHeld: 0 },
							])
						}
					>
						<Plus className="h-4 w-4 mr-1" /> Add Directorship
					</Button>
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-base">Unlisted Equity Shares</CardTitle>
					<CardDescription>
						Holdings in unlisted companies at any time during the FY
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{unlistedShares.map((entry: UnlistedShareEntry, idx: number) => (
						<div key={idx} className="border rounded-lg p-3 space-y-3">
							<div className="flex items-center justify-between">
								<span className="font-medium text-xs">Holding {idx + 1}</span>
								<Button
									variant="ghost"
									size="sm"
									onClick={(): void =>
										setUnlistedShares((prev: UnlistedShareEntry[]) =>
											prev.filter(
												(_: UnlistedShareEntry, i: number): boolean =>
													i !== idx,
											),
										)
									}
								>
									<Trash2 className="h-4 w-4 text-destructive" />
								</Button>
							</div>
							<div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
								<div>
									<Label className="text-xs">Company Name</Label>
									<Input
										value={entry.companyName}
										onChange={(
											e: React.ChangeEvent<HTMLInputElement>,
										): void => {
											const updated = [...unlistedShares];
											updated[idx] = {
												...updated[idx],
												companyName: e.target.value,
											};
											setUnlistedShares(updated);
										}}
									/>
								</div>
								<div>
									<Label className="text-xs">PAN of Company</Label>
									<Input
										value={entry.companyPAN}
										onChange={(
											e: React.ChangeEvent<HTMLInputElement>,
										): void => {
											const updated = [...unlistedShares];
											updated[idx] = {
												...updated[idx],
												companyPAN: e.target.value.toUpperCase(),
											};
											setUnlistedShares(updated);
										}}
										maxLength={10}
									/>
								</div>
								<div>
									<Label className="text-xs">Opening Shares</Label>
									<Input
										type="number"
										value={entry.openingShares || ""}
										onChange={(
											e: React.ChangeEvent<HTMLInputElement>,
										): void => {
											const updated = [...unlistedShares];
											updated[idx] = {
												...updated[idx],
												openingShares: Number(e.target.value),
											};
											setUnlistedShares(updated);
										}}
									/>
								</div>
								<div>
									<Label className="text-xs">Acquisition Cost (₹)</Label>
									<Input
										type="number"
										value={entry.acquisitionCost || ""}
										onChange={(
											e: React.ChangeEvent<HTMLInputElement>,
										): void => {
											const updated = [...unlistedShares];
											updated[idx] = {
												...updated[idx],
												acquisitionCost: Number(e.target.value),
											};
											setUnlistedShares(updated);
										}}
									/>
								</div>
								<div>
									<Label className="text-xs">Closing Shares</Label>
									<Input
										type="number"
										value={entry.closingShares || ""}
										onChange={(
											e: React.ChangeEvent<HTMLInputElement>,
										): void => {
											const updated = [...unlistedShares];
											updated[idx] = {
												...updated[idx],
												closingShares: Number(e.target.value),
											};
											setUnlistedShares(updated);
										}}
									/>
								</div>
							</div>
						</div>
					))}
					<Button
						variant="outline"
						size="sm"
						onClick={(): void =>
							setUnlistedShares((prev: UnlistedShareEntry[]) => [
								...prev,
								{
									companyName: "",
									companyPAN: "",
									openingShares: 0,
									closingShares: 0,
									acquisitionCost: 0,
								},
							])
						}
					>
						<Plus className="h-4 w-4 mr-1" /> Add Unlisted Share Holding
					</Button>
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-base">
						Loss Carry Forward (Schedule CYLA / BFLA / CFL)
					</CardTitle>
					<CardDescription>
						Losses from prior assessment years eligible for carry-forward and
						set-off
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{lossCarryForward.map((entry: LossCarryForward, idx: number) => (
						<div key={idx} className="border rounded-lg p-3 space-y-3">
							<div className="flex items-center justify-between">
								<span className="font-medium text-xs">
									Loss from AY {entry.assessmentYear || "—"}
								</span>
								<Button
									variant="ghost"
									size="sm"
									onClick={(): void =>
										setLossCarryForward((prev: LossCarryForward[]) =>
											prev.filter(
												(_: LossCarryForward, i: number): boolean => i !== idx,
											),
										)
									}
								>
									<Trash2 className="h-4 w-4 text-destructive" />
								</Button>
							</div>
							<div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
								<div>
									<Label className="text-xs">Assessment Year *</Label>
									<Select
										value={entry.assessmentYear}
										onValueChange={(v: string): void => {
											const updated = [...lossCarryForward];
											updated[idx] = { ...updated[idx], assessmentYear: v };
											setLossCarryForward(updated);
										}}
									>
										<SelectTrigger>
											<SelectValue placeholder="Select AY" />
										</SelectTrigger>
										<SelectContent>
											{[
												"2024-25",
												"2023-24",
												"2022-23",
												"2021-22",
												"2020-21",
												"2019-20",
												"2018-19",
												"2017-18",
											].map((ay) => (
												<SelectItem key={ay} value={ay}>
													{ay}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div>
									<Label className="text-xs">Loss Type</Label>
									<Select
										value={entry.lossType}
										onValueChange={(v: string): void => {
											const updated = [...lossCarryForward];
											updated[idx] = {
												...updated[idx],
												lossType: v as LossCarryForward["lossType"],
											};
											setLossCarryForward(updated);
										}}
									>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="house_property">
												House Property Loss
											</SelectItem>
											<SelectItem value="short_term_capital">
												Short-Term Capital Loss
											</SelectItem>
											<SelectItem value="long_term_capital">
												Long-Term Capital Loss
											</SelectItem>
											<SelectItem value="business">Business Loss</SelectItem>
											<SelectItem value="speculation">
												Speculation Loss
											</SelectItem>
											<SelectItem value="specified_business">
												Specified Business Loss (35AD)
											</SelectItem>
										</SelectContent>
									</Select>
								</div>
								<div>
									<Label className="text-xs">Loss Amount (₹)</Label>
									<Input
										type="number"
										value={entry.lossAmount || ""}
										onChange={(
											e: React.ChangeEvent<HTMLInputElement>,
										): void => {
											const updated = [...lossCarryForward];
											updated[idx] = {
												...updated[idx],
												lossAmount: Number(e.target.value),
											};
											setLossCarryForward(updated);
										}}
									/>
								</div>
								<div>
									<Label className="text-xs">Set Off This Year (₹)</Label>
									<Input
										type="number"
										value={entry.setOffAmount || ""}
										onChange={(
											e: React.ChangeEvent<HTMLInputElement>,
										): void => {
											const updated = [...lossCarryForward];
											updated[idx] = {
												...updated[idx],
												setOffAmount: Number(e.target.value),
											};
											setLossCarryForward(updated);
										}}
									/>
								</div>
								<div>
									<Label className="text-xs">Carried Forward (₹)</Label>
									<div className="text-sm mt-1 font-medium p-2 bg-muted rounded">
										₹
										{(entry.lossAmount - entry.setOffAmount).toLocaleString(
											"en-IN",
										)}
									</div>
								</div>
							</div>
						</div>
					))}
					<Button
						variant="outline"
						size="sm"
						onClick={(): void =>
							setLossCarryForward((prev: LossCarryForward[]) => [
								...prev,
								{
									assessmentYear: "",
									lossType: "house_property",
									lossAmount: 0,
									setOffAmount: 0,
									carriedForwardAmount: 0,
									housePropertyLoss: 0,
									shortTermCapitalLoss: 0,
									longTermCapitalLoss: 0,
									businessLoss: 0,
									speculativeBusinessLoss: 0,
									owedSpecifiedBusinessLoss: 0,
								},
							])
						}
					>
						<Plus className="h-4 w-4 mr-1" /> Add Brought Forward Loss
					</Button>
					{lossCarryForward.length > 0 && (
						<div className="mt-3 p-2 bg-amber-50 dark:bg-amber-950 rounded text-sm">
							<strong>Set-off rules:</strong> STCL against any CG; LTCL only
							against LTCG; HP loss against any head (max ₹2L); Business loss
							against any head except salary. Carry-forward up to 8 AYs (HP
							loss: no limit).
						</div>
					)}
				</CardContent>
			</Card>

			{["ITR-2", "ITR-3"].includes(recommendedForm) && (
				<Card>
					<CardHeader className="pb-3">
						<CardTitle className="text-base">
							Special Rate Income (Schedule SI)
						</CardTitle>
						<CardDescription>
							Income taxable at special rates — not at slab rate
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
							<div>
								<Label className="text-xs">Lottery / Winnings (₹)</Label>
								<Input
									type="number"
									value={specialRateIncome.lottery || ""}
									onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
										setSpecialRateIncome((p: SpecialRateIncome) => ({
											...p,
											lottery: Number(e.target.value),
										}))
									}
								/>
							</div>
							<div>
								<Label className="text-xs">Horse Racing (₹)</Label>
								<Input
									type="number"
									value={specialRateIncome.horseRacing || ""}
									onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
										setSpecialRateIncome((p: SpecialRateIncome) => ({
											...p,
											horseRacing: Number(e.target.value),
										}))
									}
								/>
							</div>
							<div>
								<Label className="text-xs">Online Gaming (₹)</Label>
								<Input
									type="number"
									value={specialRateIncome.onlineGaming || ""}
									onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
										setSpecialRateIncome((p: SpecialRateIncome) => ({
											...p,
											onlineGaming: Number(e.target.value),
										}))
									}
								/>
							</div>
							<div>
								<Label className="text-xs">Other Special Rate Income (₹)</Label>
								<Input
									type="number"
									value={specialRateIncome.otherSpecial || ""}
									onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
										setSpecialRateIncome((p: SpecialRateIncome) => ({
											...p,
											otherSpecial: Number(e.target.value),
										}))
									}
								/>
							</div>
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
};
