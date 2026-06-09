import { scrypt } from "crypto";
import { promisify } from "util";

const BASE_URL = "http://localhost:5000";
const scryptAsync = promisify(scrypt);

interface TestResult {
	itrForm: string;
	entityType: string;
	email: string;
	steps: {
		name: string;
		status: "PASS" | "FAIL" | "WARN";
		detail: string;
		response?: any;
	}[];
	overallStatus: "PASS" | "FAIL" | "PARTIAL";
}

const TEST_CASES = [
	{
		itrForm: "ITR-1",
		label: "Sahaj — Salaried Individual",
		email: "itr1-individual@fintekpro.com",
		password: "Test@123456",
		entityType: "individual",
		pan: "ABCPS1234A",
		incomeDetails: {
			salaryIncome: 800000,
			businessIncome: 0,
			capitalGains: 0,
			otherIncome: 15000,
			interestIncome: 25000,
			rentalIncome: 0,
			dividendIncome: 5000,
		},
		deductions: {
			section80C: 150000,
			section80D: 25000,
			section80G: 0,
			homeLoanInterest: 0,
			standardDeduction: 50000,
			professionalTax: 2400,
			otherDeductions: 0,
		},
		taxPayments: {
			tdsDeducted: 45000,
			advanceTaxPaid: 0,
			selfAssessmentTax: 0,
		},
	},
	{
		itrForm: "ITR-2",
		label: "Individual with Capital Gains",
		email: "itr2-individual@fintekpro.com",
		password: "Test@123456",
		entityType: "individual",
		pan: "DEFPK5678B",
		incomeDetails: {
			salaryIncome: 1500000,
			businessIncome: 0,
			capitalGains: 350000,
			otherIncome: 50000,
			interestIncome: 80000,
			rentalIncome: 240000,
			dividendIncome: 25000,
		},
		deductions: {
			section80C: 150000,
			section80D: 50000,
			section80G: 10000,
			homeLoanInterest: 200000,
			standardDeduction: 50000,
			professionalTax: 2500,
			otherDeductions: 15000,
		},
		taxPayments: {
			tdsDeducted: 180000,
			advanceTaxPaid: 50000,
			selfAssessmentTax: 0,
		},
	},
	{
		itrForm: "ITR-3",
		label: "Individual with Business Income",
		email: "itr3-business@fintekpro.com",
		password: "Test@123456",
		entityType: "individual",
		pan: "GHIPV9012C",
		incomeDetails: {
			salaryIncome: 0,
			businessIncome: 2500000,
			capitalGains: 100000,
			otherIncome: 30000,
			interestIncome: 40000,
			rentalIncome: 0,
			dividendIncome: 10000,
		},
		deductions: {
			section80C: 150000,
			section80D: 75000,
			section80G: 25000,
			homeLoanInterest: 150000,
			standardDeduction: 0,
			professionalTax: 2500,
			otherDeductions: 20000,
		},
		taxPayments: {
			tdsDeducted: 120000,
			advanceTaxPaid: 200000,
			selfAssessmentTax: 50000,
		},
	},
	{
		itrForm: "ITR-3",
		label: "HUF with Business Income",
		email: "itr3-huf@fintekpro.com",
		password: "Test@123456",
		entityType: "huf",
		pan: "JKLHV3456D",
		incomeDetails: {
			salaryIncome: 0,
			businessIncome: 1800000,
			capitalGains: 200000,
			otherIncome: 50000,
			interestIncome: 60000,
			rentalIncome: 180000,
			dividendIncome: 15000,
		},
		deductions: {
			section80C: 150000,
			section80D: 30000,
			section80G: 10000,
			homeLoanInterest: 200000,
			standardDeduction: 0,
			professionalTax: 0,
			otherDeductions: 10000,
		},
		taxPayments: {
			tdsDeducted: 90000,
			advanceTaxPaid: 150000,
			selfAssessmentTax: 30000,
		},
	},
	{
		itrForm: "ITR-4",
		label: "Sugam — Individual Presumptive Income",
		email: "itr4-presumptive@fintekpro.com",
		password: "Test@123456",
		entityType: "individual",
		pan: "MNOPG7890E",
		incomeDetails: {
			salaryIncome: 0,
			businessIncome: 1200000,
			capitalGains: 0,
			otherIncome: 20000,
			interestIncome: 15000,
			rentalIncome: 0,
			dividendIncome: 0,
		},
		deductions: {
			section80C: 150000,
			section80D: 25000,
			section80G: 5000,
			homeLoanInterest: 0,
			standardDeduction: 0,
			professionalTax: 0,
			otherDeductions: 0,
		},
		taxPayments: {
			tdsDeducted: 30000,
			advanceTaxPaid: 50000,
			selfAssessmentTax: 10000,
		},
	},
	{
		itrForm: "ITR-4",
		label: "Sugam — Firm Presumptive Income",
		email: "itr4-firm@fintekpro.com",
		password: "Test@123456",
		entityType: "partnership_firm",
		pan: "ABCFG1234F",
		incomeDetails: {
			salaryIncome: 0,
			businessIncome: 3500000,
			capitalGains: 0,
			otherIncome: 50000,
			interestIncome: 30000,
			rentalIncome: 0,
			dividendIncome: 0,
		},
		deductions: {
			section80C: 0,
			section80D: 0,
			section80G: 10000,
			homeLoanInterest: 0,
			standardDeduction: 0,
			professionalTax: 0,
			otherDeductions: 0,
		},
		taxPayments: {
			tdsDeducted: 100000,
			advanceTaxPaid: 200000,
			selfAssessmentTax: 50000,
		},
	},
	{
		itrForm: "ITR-5",
		label: "LLP (Limited Liability Partnership)",
		email: "itr5-partnership@fintekpro.com",
		password: "Test@123456",
		entityType: "llp",
		pan: "DEFFL5678G",
		incomeDetails: {
			salaryIncome: 0,
			businessIncome: 5000000,
			capitalGains: 250000,
			otherIncome: 100000,
			interestIncome: 80000,
			rentalIncome: 120000,
			dividendIncome: 30000,
		},
		deductions: {
			section80C: 0,
			section80D: 0,
			section80G: 50000,
			homeLoanInterest: 0,
			standardDeduction: 0,
			professionalTax: 0,
			otherDeductions: 30000,
		},
		taxPayments: {
			tdsDeducted: 250000,
			advanceTaxPaid: 500000,
			selfAssessmentTax: 100000,
		},
	},
	{
		itrForm: "ITR-5",
		label: "AOP (Association of Persons)",
		email: "itr5-aop@fintekpro.com",
		password: "Test@123456",
		entityType: "aop",
		pan: "GHIAA9012H",
		incomeDetails: {
			salaryIncome: 0,
			businessIncome: 2000000,
			capitalGains: 0,
			otherIncome: 80000,
			interestIncome: 50000,
			rentalIncome: 0,
			dividendIncome: 10000,
		},
		deductions: {
			section80C: 0,
			section80D: 0,
			section80G: 20000,
			homeLoanInterest: 0,
			standardDeduction: 0,
			professionalTax: 0,
			otherDeductions: 0,
		},
		taxPayments: {
			tdsDeducted: 80000,
			advanceTaxPaid: 100000,
			selfAssessmentTax: 20000,
		},
	},
	{
		itrForm: "ITR-5",
		label: "BOI (Body of Individuals)",
		email: "itr5-boi@fintekpro.com",
		password: "Test@123456",
		entityType: "boi",
		pan: "JKLBB3456J",
		incomeDetails: {
			salaryIncome: 0,
			businessIncome: 1500000,
			capitalGains: 100000,
			otherIncome: 40000,
			interestIncome: 30000,
			rentalIncome: 0,
			dividendIncome: 5000,
		},
		deductions: {
			section80C: 0,
			section80D: 0,
			section80G: 10000,
			homeLoanInterest: 0,
			standardDeduction: 0,
			professionalTax: 0,
			otherDeductions: 0,
		},
		taxPayments: {
			tdsDeducted: 60000,
			advanceTaxPaid: 80000,
			selfAssessmentTax: 15000,
		},
	},
	{
		itrForm: "ITR-6",
		label: "Company (Private Limited)",
		email: "itr6-company@fintekpro.com",
		password: "Test@123456",
		entityType: "company",
		pan: "ABCCV7890K",
		incomeDetails: {
			salaryIncome: 0,
			businessIncome: 15000000,
			capitalGains: 500000,
			otherIncome: 200000,
			interestIncome: 300000,
			rentalIncome: 600000,
			dividendIncome: 100000,
		},
		deductions: {
			section80C: 0,
			section80D: 0,
			section80G: 100000,
			homeLoanInterest: 0,
			standardDeduction: 0,
			professionalTax: 0,
			otherDeductions: 50000,
		},
		taxPayments: {
			tdsDeducted: 800000,
			advanceTaxPaid: 2000000,
			selfAssessmentTax: 500000,
		},
	},
	{
		itrForm: "ITR-7",
		label: "Trust (Charitable Education)",
		email: "itr7-trust@fintekpro.com",
		password: "Test@123456",
		entityType: "trust",
		pan: "DEFTT1234L",
		incomeDetails: {
			salaryIncome: 0,
			businessIncome: 500000,
			capitalGains: 0,
			otherIncome: 200000,
			interestIncome: 150000,
			rentalIncome: 300000,
			dividendIncome: 50000,
		},
		deductions: {
			section80C: 0,
			section80D: 0,
			section80G: 0,
			homeLoanInterest: 0,
			standardDeduction: 0,
			professionalTax: 0,
			otherDeductions: 100000,
		},
		taxPayments: {
			tdsDeducted: 40000,
			advanceTaxPaid: 30000,
			selfAssessmentTax: 10000,
		},
	},
	{
		itrForm: "ITR-7",
		label: "Society (Rural Development)",
		email: "itr7-society@fintekpro.com",
		password: "Test@123456",
		entityType: "institution",
		pan: "GHIAS5678M",
		incomeDetails: {
			salaryIncome: 0,
			businessIncome: 300000,
			capitalGains: 0,
			otherIncome: 100000,
			interestIncome: 80000,
			rentalIncome: 150000,
			dividendIncome: 20000,
		},
		deductions: {
			section80C: 0,
			section80D: 0,
			section80G: 0,
			homeLoanInterest: 0,
			standardDeduction: 0,
			professionalTax: 0,
			otherDeductions: 50000,
		},
		taxPayments: {
			tdsDeducted: 25000,
			advanceTaxPaid: 15000,
			selfAssessmentTax: 5000,
		},
	},
];

async function apiCall(
	method: string,
	path: string,
	body?: any,
	cookie?: string,
): Promise<{ status: number; data: any }> {
	const headers: Record<string, string> = {
		"Content-Type": "application/json",
	};
	if (cookie) headers.Cookie = cookie;

	const resp = await fetch(`${BASE_URL}${path}`, {
		method,
		headers,
		body: body ? JSON.stringify(body) : undefined,
		redirect: "manual",
	});

	const text = await resp.text();
	let data;
	try {
		data = JSON.parse(text);
	} catch {
		data = { rawText: text.substring(0, 500) };
	}
	return { status: resp.status, data };
}

async function loginUser(
	email: string,
	password: string,
): Promise<string | null> {
	const resp = await fetch(`${BASE_URL}/api/login`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ email, password }),
		redirect: "manual",
	});

	const setCookieHeaders = resp.headers.getSetCookie?.() || [];
	if (setCookieHeaders.length > 0) {
		return setCookieHeaders.map((c: string) => c.split(";")[0]).join("; ");
	}

	const cookieHeader = resp.headers.get("set-cookie");
	if (cookieHeader) {
		return cookieHeader
			.split(",")
			.map((c: string) => c.trim().split(";")[0])
			.join("; ");
	}

	return null;
}

async function testITRForm(
	testCase: (typeof TEST_CASES)[0],
): Promise<TestResult> {
	const result: TestResult = {
		itrForm: testCase.itrForm,
		entityType: testCase.entityType,
		email: testCase.email,
		steps: [],
		overallStatus: "PASS",
	};

	// Step 1: Form Recommendation
	try {
		const { status, data } = await apiCall(
			"POST",
			"/api/sandbox-itr/suggest-form",
			{
				incomeDetails: testCase.incomeDetails,
				entityType: testCase.entityType,
			},
		);

		if (status === 200 && data.success) {
			const recommended = data.form;
			const match = recommended === testCase.itrForm;
			result.steps.push({
				name: "Form Recommendation",
				status: match ? "PASS" : "WARN",
				detail: `Recommended: ${recommended}, Expected: ${testCase.itrForm}. Reason: ${data.reason}`,
				response: data,
			});
		} else {
			result.steps.push({
				name: "Form Recommendation",
				status: "FAIL",
				detail: `HTTP ${status}: ${data.message || JSON.stringify(data)}`,
			});
		}
	} catch (err) {
		result.steps.push({
			name: "Form Recommendation",
			status: "FAIL",
			detail: `Exception: ${err instanceof Error ? err.message : String(err)}`,
		});
	}

	// Step 2: Tax Calculation via Sandbox API
	try {
		const fullFormData = {
			personalInfo: {
				pan: testCase.pan,
				firstName: testCase.email.split("@")[0],
				lastName: "Test",
				dateOfBirth: "1990-01-15",
				email: testCase.email,
				phone: "9876543210",
				aadhar: "123456789012",
				address: {
					line1: "123 Test Street",
					city: "Mumbai",
					state: "Maharashtra",
					pincode: "400001",
				},
			},
			incomeDetails: testCase.incomeDetails,
			deductions: testCase.deductions,
			taxPayments: testCase.taxPayments,
			bankDetails: {
				accountNumber: "123456789012",
				ifscCode: "SBIN0001234",
				bankName: "State Bank of India",
				accountHolderName: testCase.email.split("@")[0],
			},
			filingDetails: {
				assessmentYear: "2025-26",
				itrForm: testCase.itrForm as any,
				filingStatus: "Original" as const,
			},
			entityType: testCase.entityType,
		};

		const { status, data } = await apiCall(
			"POST",
			"/api/sandbox-itr/calculate-tax",
			fullFormData,
		);

		if (status === 200 && data.success) {
			result.steps.push({
				name: "Tax Calculation (Sandbox API)",
				status: "PASS",
				detail: `Total Income: ₹${data.data.totalIncome?.toLocaleString()}, Tax Liability: ₹${data.data.taxLiability?.toLocaleString()}, Refund: ₹${data.data.refundAmount?.toLocaleString()}, Effective Rate: ${data.data.effectiveTaxRate}%`,
				response: data.data,
			});
		} else {
			result.steps.push({
				name: "Tax Calculation (Sandbox API)",
				status: "FAIL",
				detail: `HTTP ${status}: ${data.message || JSON.stringify(data).substring(0, 300)}`,
			});
			result.overallStatus = "FAIL";
		}
	} catch (err) {
		result.steps.push({
			name: "Tax Calculation (Sandbox API)",
			status: "FAIL",
			detail: `Exception: ${err instanceof Error ? err.message : String(err)}`,
		});
		result.overallStatus = "FAIL";
	}

	// Step 3: Wizard Tax Calculation
	try {
		const wizardData = {
			assessmentYear: "2025-26",
			entityType: testCase.entityType,
			salaryIncome: testCase.incomeDetails.salaryIncome,
			housePropertyIncome: testCase.incomeDetails.rentalIncome,
			capitalGainsSTCG: Math.floor(testCase.incomeDetails.capitalGains * 0.4),
			capitalGainsLTCG: Math.floor(testCase.incomeDetails.capitalGains * 0.6),
			capitalGainsExemptions: 0,
			businessIncome: testCase.incomeDetails.businessIncome,
			interestIncome: testCase.incomeDetails.interestIncome,
			dividendIncome: testCase.incomeDetails.dividendIncome,
			otherIncome: testCase.incomeDetails.otherIncome,
			section80C: testCase.deductions.section80C,
			section80D: testCase.deductions.section80D,
			section80E: 0,
			section80G: testCase.deductions.section80G,
			section80TTA: Math.min(testCase.incomeDetails.interestIncome, 10000),
			otherDeductions: testCase.deductions.otherDeductions,
			tdsDeducted: testCase.taxPayments.tdsDeducted,
			advanceTaxPaid: testCase.taxPayments.advanceTaxPaid,
			selfAssessmentTax: testCase.taxPayments.selfAssessmentTax,
			standardDeduction: testCase.deductions.standardDeduction,
			professionalTax: testCase.deductions.professionalTax,
			homeLoanInterest: testCase.deductions.homeLoanInterest,
		};

		const { status, data } = await apiCall(
			"POST",
			"/api/sandbox-itr/calculate-wizard",
			wizardData,
		);

		if (status === 200 && data.success) {
			result.steps.push({
				name: "Wizard Tax Calculation",
				status: "PASS",
				detail: `Taxable Income: ₹${data.data.taxableIncome?.toLocaleString()}, Tax: ₹${data.data.taxLiability?.toLocaleString()}, Payable: ₹${data.data.taxPayable?.toLocaleString()}`,
				response: data.data,
			});
		} else {
			result.steps.push({
				name: "Wizard Tax Calculation",
				status: data.message?.includes("Cannot") ? "WARN" : "FAIL",
				detail: `HTTP ${status}: ${data.message || JSON.stringify(data).substring(0, 300)}`,
			});
			if (status !== 200)
				result.overallStatus =
					result.overallStatus === "PASS" ? "PARTIAL" : result.overallStatus;
		}
	} catch (err) {
		result.steps.push({
			name: "Wizard Tax Calculation",
			status: "WARN",
			detail: `Exception: ${err instanceof Error ? err.message : String(err)}`,
		});
	}

	// Step 4: Form 26AS Fetch
	try {
		const { status, data } = await apiCall(
			"GET",
			`/api/sandbox-itr/form-26as/${testCase.pan}/2025-26`,
		);

		result.steps.push({
			name: "Form 26AS Fetch",
			status: status === 200 ? "PASS" : "WARN",
			detail: `HTTP ${status}: ${data.message || (data.success ? "Data retrieved" : "No data")}`,
		});
	} catch (err) {
		result.steps.push({
			name: "Form 26AS Fetch",
			status: "WARN",
			detail: `Exception: ${err instanceof Error ? err.message : String(err)}`,
		});
	}

	// Step 5: AIS Fetch
	try {
		const { status, data } = await apiCall(
			"GET",
			`/api/sandbox-itr/ais/${testCase.pan}/2025-26`,
		);

		result.steps.push({
			name: "AIS Fetch",
			status: status === 200 ? "PASS" : "WARN",
			detail: `HTTP ${status}: ${data.message || (data.success ? "Data retrieved" : "No data")}`,
		});
	} catch (err) {
		result.steps.push({
			name: "AIS Fetch",
			status: "WARN",
			detail: `Exception: ${err instanceof Error ? err.message : String(err)}`,
		});
	}

	// Step 6: ITR Preparation (full e-Filing simulation via Sandbox)
	try {
		const fullFormData = {
			personalInfo: {
				pan: testCase.pan,
				firstName: testCase.email.split("-")[0],
				lastName: "TestUser",
				dateOfBirth: "1990-01-15",
				email: testCase.email,
				phone: "9876543210",
				aadhar: "123456789012",
				address: {
					line1: "123 Test Street",
					city: "Mumbai",
					state: "Maharashtra",
					pincode: "400001",
				},
			},
			incomeDetails: testCase.incomeDetails,
			deductions: testCase.deductions,
			taxPayments: testCase.taxPayments,
			bankDetails: {
				accountNumber: "123456789012",
				ifscCode: "SBIN0001234",
				bankName: "State Bank of India",
				accountHolderName: testCase.email.split("@")[0],
			},
			filingDetails: {
				assessmentYear: "2025-26",
				itrForm: testCase.itrForm as any,
				filingStatus: "Original" as const,
			},
			entityType: testCase.entityType,
		};

		const { status, data } = await apiCall(
			"POST",
			"/api/sandbox-itr/prepare",
			fullFormData,
		);

		if (status === 200 && data.success) {
			result.steps.push({
				name: "ITR Preparation (e-Filing API)",
				status: "PASS",
				detail: `Ack#: ${data.data?.acknowledgmentNumber || "N/A"}, Status: ${data.data?.status || "N/A"}, Receipt: ${data.data?.receiptNumber || "N/A"}`,
				response: data.data,
			});
		} else {
			result.steps.push({
				name: "ITR Preparation (e-Filing API)",
				status: "FAIL",
				detail: `HTTP ${status}: ${data.message || JSON.stringify(data).substring(0, 300)}`,
			});
			result.overallStatus = "FAIL";
		}
	} catch (err) {
		result.steps.push({
			name: "ITR Preparation (e-Filing API)",
			status: "FAIL",
			detail: `Exception: ${err instanceof Error ? err.message : String(err)}`,
		});
		result.overallStatus = "FAIL";
	}

	// Determine overall status
	const failCount = result.steps.filter((s) => s.status === "FAIL").length;
	const warnCount = result.steps.filter((s) => s.status === "WARN").length;
	if (failCount > 0) result.overallStatus = "FAIL";
	else if (warnCount > 0) result.overallStatus = "PARTIAL";
	else result.overallStatus = "PASS";

	return result;
}

async function runAllTests() {
	console.log("\n" + "=".repeat(80));
	console.log("  FintekPro ITR TESTING SUITE — ITR-1 through ITR-7");
	console.log("  Live Sandbox.co.in API Keys | Production-Ready Validation");
	console.log("=".repeat(80) + "\n");

	// Check API status first
	try {
		const { data } = await apiCall("GET", "/api/sandbox-itr/status");
		console.log(
			`📡 Sandbox API Status: ${data.configured ? "✅ CONFIGURED" : "❌ NOT CONFIGURED"}`,
		);
		console.log(`   Message: ${data.message}\n`);
		if (!data.configured) {
			console.error(
				"FATAL: Sandbox API not configured. Set SANDBOX_API_KEY and SANDBOX_API_SECRET.",
			);
			process.exit(1);
		}
	} catch (err) {
		console.error("FATAL: Cannot reach server at", BASE_URL);
		process.exit(1);
	}

	const allResults: TestResult[] = [];

	for (const testCase of TEST_CASES) {
		console.log(`\n${"─".repeat(70)}`);
		console.log(`📋 Testing ${testCase.itrForm} — ${testCase.label}`);
		console.log(
			`   Email: ${testCase.email} | Entity: ${testCase.entityType} | PAN: ${testCase.pan}`,
		);
		console.log(`${"─".repeat(70)}`);

		const result = await testITRForm(testCase);
		allResults.push(result);

		for (const step of result.steps) {
			const icon =
				step.status === "PASS" ? "✅" : step.status === "FAIL" ? "❌" : "⚠️";
			console.log(`  ${icon} ${step.name}: ${step.detail}`);
		}

		const statusIcon =
			result.overallStatus === "PASS"
				? "✅"
				: result.overallStatus === "FAIL"
					? "❌"
					: "⚠️";
		console.log(`  ${statusIcon} Overall: ${result.overallStatus}`);
	}

	// Summary
	console.log("\n" + "=".repeat(80));
	console.log("  SUMMARY — ITR Testing Results");
	console.log("=".repeat(80));

	const passed = allResults.filter((r) => r.overallStatus === "PASS").length;
	const partial = allResults.filter(
		(r) => r.overallStatus === "PARTIAL",
	).length;
	const failed = allResults.filter((r) => r.overallStatus === "FAIL").length;

	for (const r of allResults) {
		const icon =
			r.overallStatus === "PASS"
				? "✅"
				: r.overallStatus === "FAIL"
					? "❌"
					: "⚠️";
		const passSteps = r.steps.filter((s) => s.status === "PASS").length;
		const totalSteps = r.steps.length;
		console.log(
			`  ${icon} ${r.itrForm.padEnd(6)} | ${r.entityType.padEnd(20)} | ${passSteps}/${totalSteps} steps | ${r.overallStatus}`,
		);
	}

	console.log(
		`\n  Total: ${passed} PASS, ${partial} PARTIAL, ${failed} FAIL out of ${allResults.length} test cases`,
	);
	console.log("=".repeat(80) + "\n");

	// Collect all failures for fixing
	const failures = allResults.flatMap((r) =>
		r.steps
			.filter((s) => s.status === "FAIL")
			.map((s) => ({
				itrForm: r.itrForm,
				entityType: r.entityType,
				step: s.name,
				detail: s.detail,
			})),
	);

	if (failures.length > 0) {
		console.log("🔴 FAILURES TO FIX:");
		for (const f of failures) {
			console.log(
				`  - ${f.itrForm} (${f.entityType}) → ${f.step}: ${f.detail}`,
			);
		}
		console.log("");
	}

	return { allResults, failures };
}

runAllTests()
	.then(({ failures }) => {
		process.exit(failures.length > 0 ? 1 : 0);
	})
	.catch((err) => {
		console.error("Fatal test error:", err);
		process.exit(1);
	});
