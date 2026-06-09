import React from "react";
import { Info } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useTax } from "../TaxContext";
import { TrustDetails } from "../types";

export const TrustIncomeSection: React.FC = (): React.ReactElement => {
	const { trustDetails, setTrustDetails } = useTax();
	return (
		<div className="space-y-4">
			<Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
				<Info className="h-4 w-4" />
				<AlertDescription className="text-sm">
					ITR-7 specific schedules: Voluntary contributions, corpus donations,
					application of income, and Section 11/12/13 exemptions.
				</AlertDescription>
			</Alert>

			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-base">
						Schedule VC — Voluntary Contributions & Corpus
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
						<div>
							<Label className="text-xs">Corpus Donations (₹)</Label>
							<Input
								type="number"
								value={trustDetails.corpusDonations || ""}
								onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
									setTrustDetails((p: TrustDetails) => ({
										...p,
										corpusDonations: Number(e.target.value),
									}))
								}
							/>
							<p className="text-xs text-muted-foreground mt-1">
								Donations with specific direction to form part of corpus —
								exempt u/s 11(1)(d)
							</p>
						</div>
						<div>
							<Label className="text-xs">Voluntary Contributions (₹)</Label>
							<Input
								type="number"
								value={trustDetails.voluntaryContributions || ""}
								onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
									setTrustDetails((p: TrustDetails) => ({
										...p,
										voluntaryContributions: Number(e.target.value),
									}))
								}
							/>
							<p className="text-xs text-muted-foreground mt-1">
								General donations without corpus direction
							</p>
						</div>
						<div>
							<Label className="text-xs">Anonymous Donations (₹)</Label>
							<Input
								type="number"
								value={trustDetails.anonymousDonations || ""}
								onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
									setTrustDetails((p: TrustDetails) => ({
										...p,
										anonymousDonations: Number(e.target.value),
									}))
								}
							/>
							<p className="text-xs text-muted-foreground mt-1">
								Donations where donor identity not available — taxed at 30%
								beyond threshold
							</p>
						</div>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-base">
						Application of Income & Accumulation
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
						<div>
							<Label className="text-xs">Application of Income (₹)</Label>
							<Input
								type="number"
								value={trustDetails.applicationOfIncome || ""}
								onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
									setTrustDetails((p: TrustDetails) => ({
										...p,
										applicationOfIncome: Number(e.target.value),
									}))
								}
							/>
							<p className="text-xs text-muted-foreground mt-1">
								Amount actually spent on objects of the trust during the FY
							</p>
						</div>
						<div>
							<Label className="text-xs">Accumulated Income (₹)</Label>
							<Input
								type="number"
								value={trustDetails.accumulatedIncome || ""}
								onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
									setTrustDetails((p: TrustDetails) => ({
										...p,
										accumulatedIncome: Number(e.target.value),
									}))
								}
							/>
						</div>
						<div>
							<Label className="text-xs">
								Accumulation % (max 15% u/s 11(1)(a))
							</Label>
							<Input
								type="number"
								value={trustDetails.accumulationPercentage}
								onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
									setTrustDetails((p: TrustDetails) => ({
										...p,
										accumulationPercentage: Number(e.target.value),
									}))
								}
								max={100}
							/>
						</div>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-base">
						Exemptions — Section 11 / 12 / 13
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
						<div>
							<Label className="text-xs">Section 11 Exemption (₹)</Label>
							<Input
								type="number"
								value={trustDetails.section11Exemption || ""}
								onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
									setTrustDetails((p: TrustDetails) => ({
										...p,
										section11Exemption: Number(e.target.value),
									}))
								}
							/>
							<p className="text-xs text-muted-foreground mt-1">
								Income applied for charitable/religious purposes
							</p>
						</div>
						<div>
							<Label className="text-xs">Section 12 Exemption (₹)</Label>
							<Input
								type="number"
								value={trustDetails.section12Exemption || ""}
								onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
									setTrustDetails((p: TrustDetails) => ({
										...p,
										section12Exemption: Number(e.target.value),
									}))
								}
							/>
							<p className="text-xs text-muted-foreground mt-1">
								Voluntary contributions treated as income
							</p>
						</div>
						<div>
							<Label className="text-xs">
								Investment in Specified Mode (₹)
							</Label>
							<Input
								type="number"
								value={trustDetails.investmentInSpecifiedMode || ""}
								onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
									setTrustDetails((p: TrustDetails) => ({
										...p,
										investmentInSpecifiedMode: Number(e.target.value),
									}))
								}
							/>
							<p className="text-xs text-muted-foreground mt-1">
								Schedule-J: Investments as per Section 11(5) — government
								securities, FDs, etc.
							</p>
						</div>
					</div>
					<div className="mt-3 p-2 bg-amber-50 dark:bg-amber-950 rounded text-sm">
						<strong>Section 13 warning:</strong> If income is applied for
						private benefit, invested outside specified modes, or trust has
						specified violations, exemption u/s 11 and 12 may be denied.
					</div>
				</CardContent>
			</Card>
		</div>
	);
};
