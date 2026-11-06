import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
	Award,
	Globe,
	ShieldCheck,
	CheckCircle,
	AlertTriangle,
} from "lucide-react";

interface CACertificationsPanelProps {
	partnerId: string;
	caProfile?: any;
}

export function CACertificationsPanel({ partnerId, caProfile }: CACertificationsPanelProps) {
	const { toast } = useToast();
	const _queryClient = useQueryClient();

	// Form 15CB State
	const [remitterName, setRemitterName] = useState("");
	const [remitterPan, setRemitterPan] = useState("");
	const [beneficiaryName, setBeneficiaryName] = useState("");
	const [beneficiaryCountry, setBeneficiaryCountry] = useState("United States");
	const [currency, setCurrency] = useState("USD");
	const [amountFc, setAmountFc] = useState<number>(10000);
	const [exchangeRate, setExchangeRate] = useState<number>(86.5);
	const [nature, setNature] = useState<string>("SOFTWARE");
	const [dtaaApplicable, _setDtaaApplicable] = useState<boolean>(true);
	const [dtaaTaxRate, setDtaaTaxRate] = useState<number>(10);
	const [udin15cb, setUdin15cb] = useState<string>("");
	const [generated15cb, setGenerated15cb] = useState<any>(null);

	// Net Worth Certificate State
	const [clientName, setClientName] = useState("");
	const [purpose, setPurpose] = useState<string>("VISA");
	const [asOfDate, setAsOfDate] = useState<string>(new Date().toISOString().split("T")[0]);
	const [bankBal, setBankBal] = useState<number>(500000);
	const [mfBal, setMfBal] = useState<number>(1500000);
	const [equitiesBal, setEquitiesBal] = useState<number>(2000000);
	const [fdBal, setFdBal] = useState<number>(1000000);
	const [realEstate, setRealEstate] = useState<number>(8500000);
	const [gold, setGold] = useState<number>(800000);
	const [liabilities, setLiabilities] = useState<number>(1800000);
	const [udinNw, setUdinNw] = useState<string>("");
	const [generatedNw, setGeneratedNw] = useState<any>(null);

	// Quick UDIN Validator State
	const [testUdin, setTestUdin] = useState<string>("");
	const [udinResult, setUdinResult] = useState<any>(null);

	// UDIN Verification Mutation
	const validateUdinMutation = useMutation({
		mutationFn: async () => {
			const res = await apiRequest("POST", "/api/ca/certification/udin/validate", {
				udin: testUdin,
				membershipNumber: caProfile?.icaiNumber,
			});
			return res.json();
		},
		onSuccess: (data) => {
			setUdinResult(data.result);
			if (data.result.isValid) {
				toast({ title: "Valid UDIN", description: "UDIN format matches ICAI Gazette specification." });
			} else {
				toast({ title: "Invalid UDIN", description: data.result.error, variant: "destructive" });
			}
		},
	});

	// Form 15CB Draft Mutation
	const draft15cbMutation = useMutation({
		mutationFn: async () => {
			const res = await apiRequest("POST", "/api/ca/certification/15cb/draft", {
				caPartnerId: partnerId,
				remitterUserId: partnerId,
				remitterName,
				remitterPan,
				beneficiaryName,
				beneficiaryCountry,
				currency,
				amountForeignCurrency: amountFc,
				exchangeRate,
				natureOfRemittance: nature,
				dtaaApplicable,
				dtaaTaxRate,
				domesticTaxRate: 20,
				peInIndia: false,
				udin: udin15cb,
			});
			return res.json();
		},
		onSuccess: (data) => {
			setGenerated15cb(data.draft);
			toast({ title: "Form 15CB Draft Created", description: `Certificate #${data.draft.certificateNumber}` });
		},
		onError: (err: any) => {
			toast({ title: "Generation Failed", description: err.message, variant: "destructive" });
		},
	});

	// Net Worth Certificate Mutation
	const generateNwMutation = useMutation({
		mutationFn: async () => {
			const res = await apiRequest("POST", "/api/ca/certification/networth/generate", {
				caPartnerId: partnerId,
				userId: partnerId,
				asOfDate,
				purpose,
				liquidAssets: {
					bankBalances: bankBal,
					mutualFunds: mfBal,
					listedEquities: equitiesBal,
					fixedDeposits: fdBal,
					bondsAndDebentures: 0,
				},
				illiquidAssets: {
					realEstate,
					goldAndJewellery: gold,
					unlistedShares: 0,
					vehiclesAndOther: 0,
				},
				liabilities: {
					homeLoans: liabilities,
					personalLoans: 0,
					creditCardsAndOther: 0,
				},
				udin: udinNw,
			});
			return res.json();
		},
		onSuccess: (data) => {
			setGeneratedNw(data.certificate);
			toast({
				title: "Net Worth Certificate Issued",
				description: `Certified: ₹${data.certificate.summary.certifiedNetWorth.toLocaleString("en-IN")}`,
			});
		},
		onError: (err: any) => {
			toast({ title: "Issuance Failed", description: err.message, variant: "destructive" });
		},
	});

	// Calculations
	const totalLiquid = bankBal + mfBal + equitiesBal + fdBal;
	const totalAssets = totalLiquid + realEstate + gold;
	const calculatedNetWorth = totalAssets - liabilities;
	const amountInr = Math.round(amountFc * exchangeRate);
	const effectiveTaxRate = dtaaApplicable ? Math.min(dtaaTaxRate, 20) : 20;
	const estimatedTds = Math.round((amountInr * effectiveTaxRate) / 100);

	return (
		<div className="space-y-6">
			<Tabs defaultValue="15cb" className="w-full">
				<TabsList className="grid grid-cols-3 w-full">
					<TabsTrigger value="15cb" className="text-xs">
						<Globe className="w-4 h-4 mr-1.5" /> Form 15CB (Remittance)
					</TabsTrigger>
					<TabsTrigger value="networth" className="text-xs">
						<Award className="w-4 h-4 mr-1.5" /> Net Worth Certification
					</TabsTrigger>
					<TabsTrigger value="udin" className="text-xs">
						<ShieldCheck className="w-4 h-4 mr-1.5" /> ICAI UDIN Validator
					</TabsTrigger>
				</TabsList>

				{/* 1. FORM 15CB REMITTANCE */}
				<TabsContent value="15cb" className="mt-4 space-y-4">
					<Card>
						<CardHeader className="py-3 px-4">
							<CardTitle className="text-sm font-semibold flex items-center gap-2">
								<Globe className="w-4 h-4 text-primary" /> Cross-Border Foreign Remittance Certificate (Rule 37BB)
							</CardTitle>
							<CardDescription className="text-xs">
								Prepares statutory CA certificate under Section 195 for foreign payments with DTAA relief determination.
							</CardDescription>
						</CardHeader>
						<CardContent className="px-4 pb-4 space-y-4">
							<div className="grid grid-cols-2 gap-4">
								<div>
									<Label className="text-xs">Remitter Full Name</Label>
									<Input
										placeholder="e.g. Acme Tech India Pvt Ltd or Sangram Mohanty"
										value={remitterName}
										onChange={(e) => setRemitterName(e.target.value)}
										className="h-8 text-xs mt-1"
									/>
								</div>
								<div>
									<Label className="text-xs">Remitter PAN</Label>
									<Input
										placeholder="e.g. ABCDE1234F"
										value={remitterPan}
										onChange={(e) => setRemitterPan(e.target.value.toUpperCase())}
										className="h-8 text-xs mt-1 font-mono uppercase"
									/>
								</div>
							</div>

							<div className="grid grid-cols-3 gap-3">
								<div>
									<Label className="text-xs">Beneficiary Entity / Person</Label>
									<Input
										placeholder="Foreign payee name"
										value={beneficiaryName}
										onChange={(e) => setBeneficiaryName(e.target.value)}
										className="h-8 text-xs mt-1"
									/>
								</div>
								<div>
									<Label className="text-xs">Destination Country</Label>
									<Input
										value={beneficiaryCountry}
										onChange={(e) => setBeneficiaryCountry(e.target.value)}
										className="h-8 text-xs mt-1"
									/>
								</div>
								<div>
									<Label className="text-xs">Remittance Currency</Label>
									<Select value={currency} onValueChange={setCurrency}>
										<SelectTrigger className="h-8 text-xs mt-1">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="USD">USD ($)</SelectItem>
											<SelectItem value="EUR">EUR (€)</SelectItem>
											<SelectItem value="GBP">GBP (£)</SelectItem>
											<SelectItem value="SGD">SGD (S$)</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</div>

							<div className="grid grid-cols-3 gap-3">
								<div>
									<Label className="text-xs">Amount in Foreign Currency</Label>
									<Input
										type="number"
										value={amountFc}
										onChange={(e) => setAmountFc(Number(e.target.value))}
										className="h-8 text-xs mt-1"
									/>
								</div>
								<div>
									<Label className="text-xs">Exchange Rate (INR/FC)</Label>
									<Input
										type="number"
										step="0.01"
										value={exchangeRate}
										onChange={(e) => setExchangeRate(Number(e.target.value))}
										className="h-8 text-xs mt-1"
									/>
								</div>
								<div>
									<Label className="text-xs">Total Remittance (INR)</Label>
									<div className="h-8 mt-1 px-3 py-1 bg-muted rounded border text-xs font-semibold flex items-center">
										₹{amountInr.toLocaleString("en-IN")}
									</div>
								</div>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div>
									<Label className="text-xs">Nature of Remittance</Label>
									<Select value={nature} onValueChange={setNature}>
										<SelectTrigger className="h-8 text-xs mt-1">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="SOFTWARE">Software License / SaaS Royalty</SelectItem>
											<SelectItem value="FTS">Fees for Technical Services (FTS)</SelectItem>
											<SelectItem value="EDUCATION">Overseas University Tuition</SelectItem>
											<SelectItem value="GIFT">LRS Gift to Relative</SelectItem>
											<SelectItem value="DIVIDEND">Dividend Remittance</SelectItem>
											<SelectItem value="OTHER">Commercial / Professional Fees</SelectItem>
										</SelectContent>
									</Select>
								</div>
								<div>
									<Label className="text-xs">DTAA Relief Rate (%)</Label>
									<Input
										type="number"
										value={dtaaTaxRate}
										onChange={(e) => setDtaaTaxRate(Number(e.target.value))}
										className="h-8 text-xs mt-1"
									/>
								</div>
							</div>

							<div>
								<Label className="text-xs">ICAI UDIN for 15CB (Optional at draft stage)</Label>
								<Input
									placeholder="e.g. 25123456BKRT987654"
									value={udin15cb}
									onChange={(e) => setUdin15cb(e.target.value.toUpperCase())}
									className="h-8 text-xs mt-1 font-mono uppercase"
								/>
							</div>

							<div className="p-3 bg-muted/30 rounded border text-xs flex items-center justify-between">
								<div>
									<span className="font-semibold text-foreground">Tax Withholding u/s 195: </span>
									<span className="text-primary font-bold">{effectiveTaxRate}% (DTAA rate)</span>
									<p className="text-[11px] text-muted-foreground mt-0.5">
										Estimated TDS Payable: ₹{estimatedTds.toLocaleString("en-IN")}
									</p>
								</div>
								<Button
									size="sm"
									className="h-8 text-xs"
									disabled={!remitterName || !remitterPan || draft15cbMutation.isPending}
									onClick={() => draft15cbMutation.mutate()}
								>
									{draft15cbMutation.isPending ? "Generating..." : "Generate 15CB Draft"}
								</Button>
							</div>

							{generated15cb && (
								<div className="mt-4 p-4 border rounded-lg bg-card text-xs space-y-2">
									<div className="flex justify-between items-center border-b pb-2">
										<Badge variant="outline" className="font-mono text-xs">
											{generated15cb.certificateNumber}
										</Badge>
										<Badge variant="default" className="text-[10px]">
											CA Certified Draft
										</Badge>
									</div>
									<p><strong>Remitter:</strong> {generated15cb.remitter.name} ({generated15cb.remitter.pan})</p>
									<p><strong>Beneficiary:</strong> {generated15cb.beneficiary.name} ({generated15cb.beneficiary.country})</p>
									<p><strong>Remittance:</strong> {generated15cb.remittance.currency} {generated15cb.remittance.amountForeignCurrency.toLocaleString()} (₹{generated15cb.remittance.amountInr.toLocaleString()})</p>
									<p><strong>Clause:</strong> {generated15cb.taxDetermination.statutoryClause}</p>
									<p className="font-mono text-[11px] text-muted-foreground">UDIN: {generated15cb.udin}</p>
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				{/* 2. NET WORTH CERTIFICATION */}
				<TabsContent value="networth" className="mt-4 space-y-4">
					<Card>
						<CardHeader className="py-3 px-4">
							<CardTitle className="text-sm font-semibold flex items-center gap-2">
								<Award className="w-4 h-4 text-primary" /> Certified Net Worth Statement
							</CardTitle>
							<CardDescription className="text-xs">
								Issued for VISA applications, LRS remittances, directorship compliance, or bank limits.
							</CardDescription>
						</CardHeader>
						<CardContent className="px-4 pb-4 space-y-4">
							<div className="grid grid-cols-3 gap-3">
								<div>
									<Label className="text-xs">Client Full Name</Label>
									<Input
										placeholder="Client name"
										value={clientName}
										onChange={(e) => setClientName(e.target.value)}
										className="h-8 text-xs mt-1"
									/>
								</div>
								<div>
									<Label className="text-xs">Certification Purpose</Label>
									<Select value={purpose} onValueChange={setPurpose}>
										<SelectTrigger className="h-8 text-xs mt-1">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="VISA">Foreign Visa Application (Student/PR)</SelectItem>
											<SelectItem value="LRS_REMITTANCE">RBI LRS Remittance Compliance</SelectItem>
											<SelectItem value="BANK_GUARANTEE">Bank Guarantee / Loan Security</SelectItem>
											<SelectItem value="DIRECTORSHIP">ROC / Corporate Directorship</SelectItem>
										</SelectContent>
									</Select>
								</div>
								<div>
									<Label className="text-xs">As of Date</Label>
									<Input
										type="date"
										value={asOfDate}
										onChange={(e) => setAsOfDate(e.target.value)}
										className="h-8 text-xs mt-1"
									/>
								</div>
							</div>

							<div className="grid grid-cols-2 gap-4">
								{/* Liquid Assets */}
								<div className="p-3 bg-muted/20 border rounded-lg space-y-2">
									<p className="text-xs font-semibold text-primary">Liquid Assets (FintekPro Verified)</p>
									<div>
										<Label className="text-[11px]">Bank Balances</Label>
										<Input
											type="number"
											value={bankBal}
											onChange={(e) => setBankBal(Number(e.target.value))}
											className="h-7 text-xs mt-0.5"
										/>
									</div>
									<div>
										<Label className="text-[11px]">Mutual Funds Portfolio</Label>
										<Input
											type="number"
											value={mfBal}
											onChange={(e) => setMfBal(Number(e.target.value))}
											className="h-7 text-xs mt-0.5"
										/>
									</div>
									<div>
										<Label className="text-[11px]">Listed Equities (Demat)</Label>
										<Input
											type="number"
											value={equitiesBal}
											onChange={(e) => setEquitiesBal(Number(e.target.value))}
											className="h-7 text-xs mt-0.5"
										/>
									</div>
									<div>
										<Label className="text-[11px]">Fixed Deposits</Label>
										<Input
											type="number"
											value={fdBal}
											onChange={(e) => setFdBal(Number(e.target.value))}
											className="h-7 text-xs mt-0.5"
										/>
									</div>
								</div>

								{/* Illiquid & Liabilities */}
								<div className="p-3 bg-muted/20 border rounded-lg space-y-2">
									<p className="text-xs font-semibold text-foreground">Illiquid Assets & Liabilities</p>
									<div>
										<Label className="text-[11px]">Real Estate / Immovable Properties</Label>
										<Input
											type="number"
											value={realEstate}
											onChange={(e) => setRealEstate(Number(e.target.value))}
											className="h-7 text-xs mt-0.5"
										/>
									</div>
									<div>
										<Label className="text-[11px]">Gold & Jewellery</Label>
										<Input
											type="number"
											value={gold}
											onChange={(e) => setGold(Number(e.target.value))}
											className="h-7 text-xs mt-0.5"
										/>
									</div>
									<div>
										<Label className="text-[11px]">Outstanding Liabilities / Home Loans</Label>
										<Input
											type="number"
											value={liabilities}
											onChange={(e) => setLiabilities(Number(e.target.value))}
											className="h-7 text-xs mt-0.5"
										/>
									</div>
									<div>
										<Label className="text-[11px]">ICAI UDIN</Label>
										<Input
											placeholder="e.g. 25123456BKRT112233"
											value={udinNw}
											onChange={(e) => setUdinNw(e.target.value.toUpperCase())}
											className="h-7 text-xs mt-0.5 font-mono uppercase"
										/>
									</div>
								</div>
							</div>

							<div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900 rounded flex items-center justify-between">
								<div>
									<p className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
										Certified Net Worth: ₹{calculatedNetWorth.toLocaleString("en-IN")}
									</p>
									<p className="text-[10px] text-emerald-800/80 dark:text-emerald-300/80">
										Gross Assets: ₹{totalAssets.toLocaleString("en-IN")} | Liabilities: ₹{liabilities.toLocaleString("en-IN")}
									</p>
								</div>
								<Button
									size="sm"
									className="h-8 text-xs"
									disabled={generateNwMutation.isPending}
									onClick={() => generateNwMutation.mutate()}
								>
									{generateNwMutation.isPending ? "Generating..." : "Generate Certificate"}
								</Button>
							</div>

							{generatedNw && (
								<div className="p-4 border rounded bg-card text-xs space-y-1">
									<div className="flex justify-between items-center">
										<p className="font-bold text-sm">Certificate #{generatedNw.certificateNumber}</p>
										<Badge variant="outline" className="font-mono text-[10px]">
											UDIN: {generatedNw.udin || "Recorded"}
										</Badge>
									</div>
									<p className="text-muted-foreground">Certified Net Worth: ₹{generatedNw.summary.certifiedNetWorth.toLocaleString("en-IN")}</p>
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>

				{/* 3. UDIN VALIDATOR */}
				<TabsContent value="udin" className="mt-4 space-y-4">
					<Card>
						<CardHeader className="py-3 px-4">
							<CardTitle className="text-sm font-semibold flex items-center gap-2">
								<ShieldCheck className="w-4 h-4 text-primary" /> ICAI UDIN Format & Security Validator
							</CardTitle>
							<CardDescription className="text-xs">
								Validates the 18-character statutory Unique Document Identification Number structure per ICAI norms.
							</CardDescription>
						</CardHeader>
						<CardContent className="px-4 pb-4 space-y-3">
							<div className="flex gap-2">
								<Input
									placeholder="Enter 18-character UDIN (e.g. 25123456BKRT998877)"
									value={testUdin}
									onChange={(e) => setTestUdin(e.target.value.toUpperCase())}
									className="h-9 text-xs font-mono uppercase"
									maxLength={18}
								/>
								<Button
									size="sm"
									className="h-9 text-xs"
									disabled={!testUdin || validateUdinMutation.isPending}
									onClick={() => validateUdinMutation.mutate()}
								>
									Validate UDIN
								</Button>
							</div>

							{udinResult && (
								<div className={`p-3 rounded border text-xs ${udinResult.isValid ? "bg-green-50 dark:bg-green-950/20 border-green-200" : "bg-red-50 dark:bg-red-950/20 border-red-200"}`}>
									<div className="flex items-center gap-2">
										{udinResult.isValid ? (
											<CheckCircle className="w-4 h-4 text-emerald-600" />
										) : (
											<AlertTriangle className="w-4 h-4 text-destructive" />
										)}
										<span className="font-bold">
											{udinResult.isValid ? "Valid ICAI UDIN Structure" : "UDIN Format Error"}
										</span>
									</div>
									{udinResult.isValid ? (
										<div className="mt-2 text-[11px] space-y-0.5 text-foreground">
											<p>Year of Issue: 20{udinResult.year}</p>
											<p>ICAI Membership Number: {udinResult.membershipNumber}</p>
											<p className="font-mono text-[10px] text-muted-foreground mt-1">Verified: {udinResult.udin}</p>
										</div>
									) : (
										<p className="mt-1 text-[11px] text-destructive">{udinResult.error}</p>
									)}
								</div>
							)}
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}

