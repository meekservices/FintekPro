import React from "react";
import { Home, Plus, Trash2, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
	FieldHint,
	CurrencyInput,
	ValidationBanner,
	formatCurrency,
} from "@/components/tax-itr/TaxITRHelpers";
import { useTax } from "../TaxContext";
import { HousePropertyEntry, HousePropertyDetails } from "../types";

export const HousePropertySection: React.FC = (): React.ReactElement => {
	const {
		recommendedForm,
		housePropertyDetails,
		setHousePropertyDetails,
		totals,
		validateStep,
		currentStepId,
	} = useTax();

	const currentValidation = validateStep(currentStepId);
	const housePropertyIncomeTotal = totals.housePropertyIncome;

	const computePropertyIncome = (property: HousePropertyEntry): number => {
		if (property.propertyType === "self_occupied") {
			return -Math.min(property.interestOnLoan, 200000);
		}
		const nav =
			property.rentalIncome - property.municipalTaxes - property.unrealizedRent;
		const stdDed = nav * 0.3;
		return nav - stdDed - property.interestOnLoan;
	};

	const addProperty = (): void => {
		const maxProps = recommendedForm === "ITR-1" ? 1 : 5;
		if (housePropertyDetails.properties.length >= maxProps) return;
		const newProp: HousePropertyEntry = {
			propertyType: "self_occupied",
			rentalIncome: 0,
			municipalTaxes: 0,
			interestOnLoan: 0,
			unrealizedRent: 0,
			address: "",
		};
		setHousePropertyDetails((prev: HousePropertyDetails) => ({
			...prev,
			propertyCount: prev.properties.length + 1,
			properties: [...prev.properties, newProp],
		}));
	};

	const removeProperty = (idx: number): void => {
		if (housePropertyDetails.properties.length <= 1) return;
		setHousePropertyDetails(
			(prev: HousePropertyDetails): HousePropertyDetails => {
				const updated = prev.properties.filter(
					(_: HousePropertyEntry, i: number): boolean => i !== idx,
				);
				const first = updated[0];
				return {
					...prev,
					propertyCount: updated.length,
					properties: updated,
					isSelfOccupied: first ? first.propertyType === "self_occupied" : true,
					rentalIncome: first ? first.rentalIncome : 0,
					municipalTaxes: first ? first.municipalTaxes : 0,
					interestOnLoan: first ? first.interestOnLoan : 0,
				};
			},
		);
	};

	const updateProperty = (
		idx: number,
		field: keyof HousePropertyEntry,
		value: string | number,
	): void => {
		setHousePropertyDetails(
			(prev: HousePropertyDetails): HousePropertyDetails => {
				const updated = [...prev.properties];
				updated[idx] = {
					...updated[idx],
					[field]: value,
				} as HousePropertyEntry;
				const backcompat: Partial<HousePropertyDetails> = {};
				if (idx === 0) {
					backcompat.isSelfOccupied =
						updated[0].propertyType === "self_occupied";
					backcompat.rentalIncome = updated[0].rentalIncome;
					backcompat.municipalTaxes = updated[0].municipalTaxes;
					backcompat.interestOnLoan = updated[0].interestOnLoan;
				}
				return { ...prev, ...backcompat, properties: updated };
			},
		);
	};

	const maxProps = recommendedForm === "ITR-1" ? 1 : 5;
	const properties =
		housePropertyDetails.properties.length > 0
			? housePropertyDetails.properties
			: [
					{
						propertyType: "self_occupied" as const,
						rentalIncome: 0,
						municipalTaxes: 0,
						interestOnLoan: 0,
						unrealizedRent: 0,
						address: "",
					},
				];

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h3 className="text-sm font-medium text-muted-foreground">
						{properties.length}{" "}
						{properties.length === 1 ? "Property" : "Properties"} added
					</h3>
				</div>
				<Button
					variant="outline"
					size="sm"
					onClick={addProperty}
					disabled={properties.length >= maxProps}
					className="gap-1.5"
				>
					<Plus className="h-4 w-4" />
					Add Property
				</Button>
			</div>

			{recommendedForm === "ITR-1" && properties.length >= 1 && (
				<Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
					<Info className="h-4 w-4 text-blue-600" />
					<AlertDescription className="text-blue-700 dark:text-blue-300">
						ITR-1 allows only 1 house property. Switch to ITR-2 or higher to add
						multiple properties.
					</AlertDescription>
				</Alert>
			)}

			{properties.map((prop, idx) => {
				const propIncome = computePropertyIncome(prop);
				const isSelf = prop.propertyType === "self_occupied";
				const isLetOut =
					prop.propertyType === "let_out" ||
					prop.propertyType === "deemed_let_out";

				return (
					<Card key={idx} className="border">
						<CardHeader className="pb-3">
							<div className="flex items-center justify-between">
								<CardTitle className="text-base flex items-center gap-2">
									<Home className="h-4 w-4" />
									Property {idx + 1}
									<Badge
										variant={isSelf ? "secondary" : "outline"}
										className="text-xs"
									>
										{prop.propertyType === "self_occupied"
											? "Self Occupied"
											: prop.propertyType === "let_out"
												? "Let Out"
												: "Deemed Let Out"}
									</Badge>
								</CardTitle>
								{properties.length > 1 && (
									<Button
										variant="ghost"
										size="sm"
										onClick={(): void => removeProperty(idx)}
										className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950 h-8 w-8 p-0"
									>
										<Trash2 className="h-4 w-4" />
									</Button>
								)}
							</div>
						</CardHeader>
						<CardContent className="space-y-5">
							<div className="space-y-3">
								<Label>
									Property Type{" "}
									<FieldHint text="Self-occupied: You live in it. Let out: You receive rent. Deemed let out: Vacant second property treated as let out." />
								</Label>
								<RadioGroup
									value={prop.propertyType}
									onValueChange={(
										v: "self_occupied" | "let_out" | "deemed_let_out",
									): void => updateProperty(idx, "propertyType", v)}
									className="flex flex-wrap gap-3"
								>
									<label
										htmlFor={`prop-self-${idx}`}
										className={`flex items-center gap-2 px-4 py-3 rounded-lg border cursor-pointer transition-all ${prop.propertyType === "self_occupied" ? "border-primary bg-primary/5" : "hover:border-muted-foreground/40"}`}
									>
										<RadioGroupItem
											value="self_occupied"
											id={`prop-self-${idx}`}
										/>
										<div>
											<span className="font-medium text-sm">Self Occupied</span>
											<p className="text-xs text-muted-foreground">
												You live in this property
											</p>
										</div>
									</label>
									<label
										htmlFor={`prop-letout-${idx}`}
										className={`flex items-center gap-2 px-4 py-3 rounded-lg border cursor-pointer transition-all ${prop.propertyType === "let_out" ? "border-primary bg-primary/5" : "hover:border-muted-foreground/40"}`}
									>
										<RadioGroupItem value="let_out" id={`prop-letout-${idx}`} />
										<div>
											<span className="font-medium text-sm">Let Out</span>
											<p className="text-xs text-muted-foreground">
												Rented to tenants
											</p>
										</div>
									</label>
									<label
										htmlFor={`prop-deemed-${idx}`}
										className={`flex items-center gap-2 px-4 py-3 rounded-lg border cursor-pointer transition-all ${prop.propertyType === "deemed_let_out" ? "border-primary bg-primary/5" : "hover:border-muted-foreground/40"}`}
									>
										<RadioGroupItem
											value="deemed_let_out"
											id={`prop-deemed-${idx}`}
										/>
										<div>
											<span className="font-medium text-sm">
												Deemed Let Out
											</span>
											<p className="text-xs text-muted-foreground">
												Vacant second property
											</p>
										</div>
									</label>
								</RadioGroup>
							</div>

							<div className="space-y-1.5">
								<Label htmlFor={`address-${idx}`}>
									Property Address
									<FieldHint text="Full address of the property including city and pin code." />
								</Label>
								<Input
									id={`address-${idx}`}
									value={prop.address}
									onChange={(e: React.ChangeEvent<HTMLInputElement>): void =>
										updateProperty(idx, "address", e.target.value)
									}
									placeholder="Enter property address"
								/>
							</div>

							<div className="grid grid-cols-1 md:grid-cols-2 gap-5">
								{isLetOut && (
									<>
										<div className="space-y-1.5">
											<Label htmlFor={`rentalIncome-${idx}`}>
												Annual Rental Income{" "}
												<span className="text-red-500">*</span>
												<FieldHint text="Total rent received during the financial year. If property was vacant for some months, enter actual rent received." />
											</Label>
											<CurrencyInput
												id={`rentalIncome-${idx}`}
												value={prop.rentalIncome}
												onChange={(v: number): void =>
													updateProperty(idx, "rentalIncome", v)
												}
												placeholder="Total annual rent"
											/>
										</div>
										<div className="space-y-1.5">
											<Label htmlFor={`municipalTaxes-${idx}`}>
												Municipal Taxes Paid
												<FieldHint text="Property tax paid to local municipality. Only deductible if actually paid during the year." />
											</Label>
											<CurrencyInput
												id={`municipalTaxes-${idx}`}
												value={prop.municipalTaxes}
												onChange={(v: number): void =>
													updateProperty(idx, "municipalTaxes", v)
												}
												placeholder="Property tax paid"
											/>
										</div>
										<div className="space-y-1.5">
											<Label htmlFor={`unrealizedRent-${idx}`}>
												Unrealized Rent
												<FieldHint text="Rent that could not be collected from tenant. Conditions under Rule 4 must be satisfied." />
											</Label>
											<CurrencyInput
												id={`unrealizedRent-${idx}`}
												value={prop.unrealizedRent}
												onChange={(v: number): void =>
													updateProperty(idx, "unrealizedRent", v)
												}
												placeholder="Unrealized rent amount"
											/>
										</div>
									</>
								)}
								<div className="space-y-1.5">
									<Label htmlFor={`interestOnLoan-${idx}`}>
										Interest on Home Loan
										<FieldHint
											text={
												isSelf
													? "Maximum ₹2,0,000 deduction for self-occupied property. Get from bank's interest certificate."
													: "Full interest is deductible for let-out property. Get from bank's interest certificate."
											}
										/>
									</Label>
									<CurrencyInput
										id={`interestOnLoan-${idx}`}
										value={prop.interestOnLoan}
										onChange={(v: number): void =>
											updateProperty(idx, "interestOnLoan", v)
										}
										placeholder="Annual home loan interest"
										max={isSelf ? 200000 : undefined}
									/>
								</div>
							</div>

							<div className="bg-muted/50 rounded-lg p-3">
								<div className="flex justify-between items-center text-sm">
									<span className="text-muted-foreground">
										Income / Loss from Property {idx + 1}
									</span>
									<span
										className={`font-semibold ${propIncome < 0 ? "text-red-600" : "text-green-600"}`}
									>
										{formatCurrency(propIncome)}
									</span>
								</div>
							</div>
						</CardContent>
					</Card>
				);
			})}

			<Card className="bg-muted/50">
				<CardContent className="p-4">
					<div className="flex justify-between items-center">
						<span className="font-medium">
							Total Income / Loss from House Property
						</span>
						<span
							className={`font-bold text-lg ${housePropertyIncomeTotal < 0 ? "text-red-600" : "text-green-600"}`}
						>
							{formatCurrency(housePropertyIncomeTotal)}
						</span>
					</div>
					{housePropertyIncomeTotal < 0 && (
						<p className="text-xs text-muted-foreground mt-1">
							This loss will reduce your total taxable income.
						</p>
					)}
				</CardContent>
			</Card>

			<ValidationBanner validation={currentValidation} />
		</div>
	);
};
