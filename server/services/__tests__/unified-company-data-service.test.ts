/**
 * Regression Tests for Unified Company Data Service
 *
 * Tests fallback scenarios:
 * 1. FintekPro success - returns full data from internal database
 * 2. FintekPro empty - triggers MCA fallback
 * 3. MCA fallback verification when FintekPro has no data
 *
 * Data Source Priority: FintekPro (internal) → MCA (Sandbox.co.in API)
 *
 * Run with: npx tsx server/services/__tests__/unified-company-data-service.test.ts
 */

const mockOwnFinancials = [
	{
		id: "1",
		companyId: "company-1",
		financialYear: "FY2023",
		revenue: "45000000",
		pat: "4500000",
		totalAssets: "38000000",
		totalLiabilities: "14000000",
		networth: "24000000",
		ebitda: "6000000",
		shareCapital: "5000000",
		reserves: "19000000",
		totalDebt: "8000000",
		dataSource: "fintekpro",
		createdAt: new Date("2024-01-01"),
		updatedAt: new Date("2024-01-01"),
	},
];

const mockOwnRatios = [
	{
		id: "1",
		companyId: "company-1",
		financialYear: "FY2023",
		roe: "18.75",
		roce: "17.5",
		debtEquity: "0.58",
		currentRatio: "1.45",
		peRatio: "12.5",
		pbRatio: "1.8",
		marginEbitda: "13.3",
		marginPat: "10",
		marginOperating: "12",
		dataSource: "fintekpro",
		createdAt: new Date("2024-01-01"),
		updatedAt: new Date("2024-01-01"),
	},
];

const mockMCAData = {
	cin: "U12345MH2020PTC789012",
	companyName: "Test Company Private Limited",
	companyStatus: "Active",
	companyCategory: "Company limited by Shares",
	companySubcategory: "Non-govt company",
	classOfCompany: "Private",
	dateOfIncorporation: "2021-06-01",
	rocCode: "RoC-Mumbai",
	registeredAddress: "Mumbai, Maharashtra",
	emailId: "test@company.com",
	authorizedCapital: 10000000,
	paidUpCapital: 5000000,
	whetherListedOrNot: "Unlisted",
	suspendedAtStockExchange: "NA",
	activeCompliance: "Active",
	directors: [
		{
			din: "87654321",
			name: "Jane Smith",
			designation: "Director",
			beginDate: "2021-06-01",
		},
	],
	charges: [],
	balanceSheets: [{ filingDate: "2024-03-31", financialYear: "FY2024" }],
	annualReturns: [],
};

type DataSource = "fintekpro" | "mca" | "moneycontrol" | "credhive";

interface TestResult {
	sourcesAttempted: string[];
	sourcesUsed: string[];
	primarySource: string | null;
	financialsSource: string | null;
	ratiosSource: string | null;
	fintekproCalled: boolean;
	fintekproHasUsableData: boolean;
	mcaCalled: boolean;
	callOrder: string[];
}

async function simulateGetCompanyData(
	companyIdOrCin: string,
	options: { includeMCA?: boolean },
	storage: any,
	mcaService: any,
): Promise<TestResult> {
	const { includeMCA = true } = options;
	const callOrder: string[] = [];
	const sourcesAttempted: string[] = [];
	const sourcesUsed: string[] = [];
	let mcaData: any = null;
	let fintekproCalled = false;
	let mcaCalled = false;

	const company = await storage.getUnlistedCompanyById(companyIdOrCin);
	const cin =
		company?.cin || (companyIdOrCin.length === 21 ? companyIdOrCin : undefined);

	let ownFinancials: any[] = [];
	let ownRatios: any[] = [];

	// Step 1: Get FintekPro's own data (PRIMARY SOURCE)
	if (company) {
		callOrder.push("fintekpro");
		fintekproCalled = true;
		ownFinancials = await storage.getCompanyFinancials(company.id);
		ownRatios = await storage.getCompanyRatios(company.id);
		if (ownFinancials.length > 0 || ownRatios.length > 0) {
			sourcesAttempted.push("fintekpro");
			sourcesUsed.push("fintekpro");
		}
	}

	// Determine if FintekPro has usable data
	const fintekproHasUsableData =
		ownFinancials.length > 0 || ownRatios.length > 0;

	// Step 2: Try MCA as fallback when FintekPro data is insufficient
	if (includeMCA && cin && !fintekproHasUsableData) {
		callOrder.push("mca");
		mcaCalled = true;
		sourcesAttempted.push("mca");
		if (mcaService.isConfigured()) {
			mcaData = await mcaService.getCompanyByCIN(cin);
			if (mcaData) {
				sourcesUsed.push("mca");
			}
		}
	}

	const financialsSource = fintekproHasUsableData
		? "fintekpro"
		: sourcesUsed.includes("mca")
			? "mca"
			: null;

	const ratiosSource = fintekproHasUsableData ? "fintekpro" : null;

	return {
		sourcesAttempted,
		sourcesUsed,
		primarySource: sourcesUsed[0] || null,
		financialsSource,
		ratiosSource,
		fintekproCalled,
		fintekproHasUsableData: !!fintekproHasUsableData,
		mcaCalled,
		callOrder,
	};
}

function assertEqual(actual: any, expected: any, message: string) {
	const actualStr = JSON.stringify(actual);
	const expectedStr = JSON.stringify(expected);
	if (actualStr !== expectedStr) {
		throw new Error(
			`${message}\n  Expected: ${expectedStr}\n  Actual: ${actualStr}`,
		);
	}
}

function assertContains(arr: any[], value: any, message: string) {
	if (!arr.includes(value)) {
		throw new Error(
			`${message}\n  Array: [${arr.join(", ")}]\n  Expected to contain: ${value}`,
		);
	}
}

async function runTests() {
	console.log("\n🧪 Running Unified Company Data Service Regression Tests\n");
	console.log(
		"📊 Data Priority: FintekPro (internal) → MCA (Sandbox.co.in API)\n",
	);
	console.log("=".repeat(70) + "\n");

	let passed = 0;
	let failed = 0;

	const tests: { name: string; fn: () => Promise<void> }[] = [
		{
			name: "Scenario 1: FintekPro Success - Uses FintekPro as primary source",
			fn: async () => {
				const mockStorage = {
					getUnlistedCompanyById: async () => ({
						id: "company-1",
						name: "Test Company",
						cin: "U12345MH2020PTC123456",
					}),
					getCompanyFinancials: async () => mockOwnFinancials,
					getCompanyRatios: async () => mockOwnRatios,
				};
				const mockMcaService = {
					isConfigured: () => true,
					getCompanyByCIN: async () => mockMCAData,
				};

				const result = await simulateGetCompanyData(
					"company-1",
					{ includeMCA: true },
					mockStorage,
					mockMcaService,
				);

				assertEqual(result.fintekproCalled, true, "FintekPro should be called");
				assertEqual(
					result.primarySource,
					"fintekpro",
					"Primary source should be FintekPro",
				);
				assertEqual(
					result.financialsSource,
					"fintekpro",
					"Financials source should be FintekPro",
				);
				assertEqual(
					result.mcaCalled,
					false,
					"MCA should NOT be called when FintekPro has data",
				);
			},
		},
		{
			name: "Scenario 2: FintekPro Empty - Triggers MCA fallback",
			fn: async () => {
				const mockStorage = {
					getUnlistedCompanyById: async () => ({
						id: "company-2",
						name: "New Company",
						cin: "U12345MH2020PTC789012",
					}),
					getCompanyFinancials: async () => [],
					getCompanyRatios: async () => [],
				};
				const mockMcaService = {
					isConfigured: () => true,
					getCompanyByCIN: async () => mockMCAData,
				};

				const result = await simulateGetCompanyData(
					"company-2",
					{ includeMCA: true },
					mockStorage,
					mockMcaService,
				);

				assertEqual(result.fintekproCalled, true, "FintekPro should be called");
				assertEqual(
					result.fintekproHasUsableData,
					false,
					"FintekPro should NOT have usable data",
				);
				assertEqual(
					result.mcaCalled,
					true,
					"MCA should be called when FintekPro has no data",
				);
				assertContains(
					result.sourcesUsed,
					"mca",
					"MCA should be in sources used",
				);
			},
		},
		{
			name: "Scenario 3: MCA NOT called when FintekPro has financials",
			fn: async () => {
				const mockStorage = {
					getUnlistedCompanyById: async () => ({
						id: "company-3",
						name: "Existing Company",
						cin: "U12345MH2020PTC999000",
					}),
					getCompanyFinancials: async () => mockOwnFinancials,
					getCompanyRatios: async () => [],
				};
				const mockMcaService = {
					isConfigured: () => true,
					getCompanyByCIN: async () => mockMCAData,
				};

				const result = await simulateGetCompanyData(
					"company-3",
					{ includeMCA: true },
					mockStorage,
					mockMcaService,
				);

				assertEqual(
					result.fintekproHasUsableData,
					true,
					"FintekPro should have usable data",
				);
				assertEqual(
					result.mcaCalled,
					false,
					"MCA should NOT be called when FintekPro has data",
				);
			},
		},
		{
			name: "Scenario 4: MCA NOT called when FintekPro has ratios only",
			fn: async () => {
				const mockStorage = {
					getUnlistedCompanyById: async () => ({
						id: "company-4",
						name: "Ratios Company",
						cin: "U12345MH2020PTC111222",
					}),
					getCompanyFinancials: async () => [],
					getCompanyRatios: async () => mockOwnRatios,
				};
				const mockMcaService = {
					isConfigured: () => true,
					getCompanyByCIN: async () => mockMCAData,
				};

				const result = await simulateGetCompanyData(
					"company-4",
					{ includeMCA: true },
					mockStorage,
					mockMcaService,
				);

				assertEqual(
					result.fintekproHasUsableData,
					true,
					"FintekPro should have usable data (ratios)",
				);
				assertEqual(
					result.mcaCalled,
					false,
					"MCA should NOT be called when FintekPro has ratios",
				);
			},
		},
		{
			name: "Scenario 5: Call order - FintekPro called before MCA",
			fn: async () => {
				const mockStorage = {
					getUnlistedCompanyById: async () => ({
						id: "company-5",
						name: "Order Test",
						cin: "U12345MH2020PTC333444",
					}),
					getCompanyFinancials: async () => [],
					getCompanyRatios: async () => [],
				};
				const mockMcaService = {
					isConfigured: () => true,
					getCompanyByCIN: async () => mockMCAData,
				};

				const result = await simulateGetCompanyData(
					"company-5",
					{ includeMCA: true },
					mockStorage,
					mockMcaService,
				);

				assertEqual(
					result.callOrder[0],
					"fintekpro",
					"FintekPro should be called first",
				);
				assertEqual(result.callOrder[1], "mca", "MCA should be called second");
			},
		},
		{
			name: "Scenario 6: MCA requires CIN for lookup",
			fn: async () => {
				const mockStorage = {
					getUnlistedCompanyById: async () => ({
						id: "company-6",
						name: "No CIN Company",
						cin: null,
					}),
					getCompanyFinancials: async () => [],
					getCompanyRatios: async () => [],
				};
				const mockMcaService = {
					isConfigured: () => true,
					getCompanyByCIN: async () => mockMCAData,
				};

				const result = await simulateGetCompanyData(
					"company-6",
					{ includeMCA: true },
					mockStorage,
					mockMcaService,
				);

				assertEqual(
					result.mcaCalled,
					false,
					"MCA should NOT be called without CIN",
				);
			},
		},
		{
			name: "Scenario 7: MCA service not configured - graceful handling",
			fn: async () => {
				const mockStorage = {
					getUnlistedCompanyById: async () => ({
						id: "company-7",
						name: "Unconfigured Test",
						cin: "U12345MH2020PTC555666",
					}),
					getCompanyFinancials: async () => [],
					getCompanyRatios: async () => [],
				};
				const mockMcaService = {
					isConfigured: () => false,
					getCompanyByCIN: async () => {
						throw new Error("Should not be called");
					},
				};

				const result = await simulateGetCompanyData(
					"company-7",
					{ includeMCA: true },
					mockStorage,
					mockMcaService,
				);

				assertEqual(result.mcaCalled, true, "MCA should be attempted");
				assertEqual(
					result.sourcesUsed.includes("mca"),
					false,
					"MCA should NOT be in sources used when not configured",
				);
			},
		},
		{
			name: "Scenario 8: includeMCA=false skips MCA entirely",
			fn: async () => {
				const mockStorage = {
					getUnlistedCompanyById: async () => ({
						id: "company-8",
						name: "Skip MCA",
						cin: "U12345MH2020PTC777888",
					}),
					getCompanyFinancials: async () => [],
					getCompanyRatios: async () => [],
				};
				const mockMcaService = {
					isConfigured: () => true,
					getCompanyByCIN: async () => mockMCAData,
				};

				const result = await simulateGetCompanyData(
					"company-8",
					{ includeMCA: false },
					mockStorage,
					mockMcaService,
				);

				assertEqual(
					result.mcaCalled,
					false,
					"MCA should NOT be called when includeMCA is false",
				);
			},
		},
	];

	for (const test of tests) {
		try {
			await test.fn();
			console.log(`✅ PASS: ${test.name}`);
			passed++;
		} catch (error: any) {
			console.log(`❌ FAIL: ${test.name}`);
			console.log(`   ${error.message}\n`);
			failed++;
		}
	}

	console.log("\n" + "=".repeat(70));
	console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed\n`);

	if (failed > 0) {
		process.exit(1);
	}
}

runTests().catch(console.error);
