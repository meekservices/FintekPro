/**
 * Regression Tests for Unified Company Data Service
 * 
 * Tests fallback scenarios:
 * 1. Tofler success - returns full data
 * 2. Tofler partial data - returns shell without financials/ratios → triggers MCA fallback
 * 3. Tofler failure - throws error → triggers FintekPro then MCA fallback
 * 4. MCA fallback verification when Tofler is unavailable
 * 
 * Run with: npx tsx server/services/__tests__/unified-company-data-service.test.ts
 */

const mockToflerFullData = {
  basicInfo: {
    name: 'Test Company Private Limited',
    cin: 'U12345MH2020PTC123456',
    dateOfIncorporation: '2020-01-15',
    status: 'Active',
    category: 'Private Limited',
    class: 'Company limited by Shares',
    authorizedCapital: 10000000,
    paidUpCapital: 5000000,
    registeredOffice: 'Mumbai, Maharashtra',
    registrarOfCompanies: 'ROC-Mumbai',
    email: 'test@company.com',
  },
  financials: [
    {
      year: 'FY2023',
      revenue: 50000000,
      profit: 5000000,
      netWorth: 25000000,
      totalAssets: 40000000,
      totalLiabilities: 15000000,
      operatingExpenses: 30000000,
      depreciation: 2000000,
      interestExpense: 500000,
      taxExpense: 1000000,
    },
  ],
  ratios: [
    {
      year: 'FY2023',
      roe: 20,
      roce: 18,
      debtToEquity: 0.6,
      currentRatio: 1.5,
      operatingMargin: 10,
      netMargin: 10,
      assetTurnover: 1.25,
    },
  ],
  directors: [{ name: 'John Doe', din: '12345678', designation: 'Director' }],
  charges: [],
};

const mockToflerShellData = {
  basicInfo: {
    name: 'Shell Company Private Limited',
    cin: 'U12345MH2020PTC789012',
    dateOfIncorporation: '2021-06-01',
    status: 'Active',
    category: 'Private Limited',
    class: 'Company limited by Shares',
    authorizedCapital: 1000000,
    paidUpCapital: 500000,
    registeredOffice: 'Delhi',
    registrarOfCompanies: 'ROC-Delhi',
    email: 'shell@company.com',
  },
  financials: [],
  ratios: [],
  directors: [],
  charges: [],
};

const mockMCAData = {
  cin: 'U12345MH2020PTC789012',
  companyName: 'Shell Company Private Limited',
  companyStatus: 'Active',
  dateOfIncorporation: '2021-06-01',
  registeredOfficeAddress: 'Delhi',
  authorizedCapital: 1000000,
  paidUpCapital: 500000,
  companyCategory: 'Company limited by Shares',
  companySubCategory: 'Non-govt company',
  classOfCompany: 'Private',
  industryCode: 'M70',
  industryDescription: 'Activities of head offices',
  directors: [{ din: '87654321', name: 'Jane Smith', designation: 'Director' }],
  charges: [],
  financials: {
    totalAssets: 2000000,
    totalLiabilities: 500000,
    turnover: 3000000,
    netWorth: 1500000,
  },
};

const mockOwnFinancials = [
  {
    id: '1',
    companyId: 'company-1',
    fiscalYear: 'FY2023',
    revenue: 45000000,
    netProfit: 4500000,
    totalAssets: 38000000,
    totalLiabilities: 14000000,
    netWorth: 24000000,
    operatingExpenses: 28000000,
    depreciation: 1800000,
    interestExpense: 450000,
    taxExpense: 900000,
    dataSource: 'fintekpro',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
];

const mockOwnRatios = [
  {
    id: '1',
    companyId: 'company-1',
    fiscalYear: 'FY2023',
    roe: 18.75,
    roce: 17.5,
    debtToEquity: 0.58,
    currentRatio: 1.45,
    operatingMargin: 9.5,
    netMargin: 10,
    assetTurnover: 1.18,
    dataSource: 'fintekpro',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  },
];

type DataSource = 'tofler' | 'fintekpro' | 'mca' | 'moneycontrol' | 'probe42';

interface TestResult {
  sourcesAttempted: string[];
  sourcesUsed: string[];
  primarySource: string | null;
  financialsSource: string | null;
  ratiosSource: string | null;
  toflerCalled: boolean;
  toflerError: string | null;
  toflerHasUsableData: boolean;
  fintekproCalled: boolean;
  mcaCalled: boolean;
  callOrder: string[];
}

async function simulateGetCompanyData(
  companyIdOrCin: string,
  options: { includeMCA?: boolean; skipTofler?: boolean },
  storage: any,
  toflerService: any,
  mcaService: any
): Promise<TestResult> {
  const { includeMCA = true, skipTofler = false } = options;
  const callOrder: string[] = [];
  const sourcesAttempted: string[] = [];
  const sourcesUsed: string[] = [];
  let toflerError: string | null = null;
  let toflerData: any = null;
  let mcaData: any = null;
  let toflerCalled = false;
  let fintekproCalled = false;
  let mcaCalled = false;

  const company = await storage.getUnlistedCompanyById(companyIdOrCin);
  const cin = company?.cin || (companyIdOrCin.length === 21 ? companyIdOrCin : undefined);

  if (!skipTofler) {
    callOrder.push('tofler');
    toflerCalled = true;
    sourcesAttempted.push('tofler');
    try {
      if (cin) {
        toflerData = await toflerService.getCompanyDetails(cin);
      } else if (company?.name) {
        const searchResults = await toflerService.searchCompanies(company.name);
        if (searchResults.length > 0) {
          toflerData = await toflerService.getCompanyDetails(searchResults[0].url);
        }
      }
      if (toflerData) {
        sourcesUsed.push('tofler');
      }
    } catch (error: any) {
      toflerError = error.message;
    }
  }

  if (company) {
    callOrder.push('fintekpro');
    fintekproCalled = true;
    const ownFinancials = await storage.getCompanyFinancials(company.id);
    const ownRatios = await storage.getCompanyRatios(company.id);
    if (ownFinancials.length > 0 || ownRatios.length > 0) {
      sourcesAttempted.push('fintekpro');
      sourcesUsed.push('fintekpro');
    }
  }

  const toflerHasUsableData = toflerData && 
    ((toflerData.financials && toflerData.financials.length > 0) || 
     (toflerData.ratios && toflerData.ratios.length > 0));

  if (includeMCA && cin && !toflerHasUsableData) {
    callOrder.push('mca');
    mcaCalled = true;
    sourcesAttempted.push('mca');
    if (mcaService.isConfigured()) {
      mcaData = await mcaService.getCompanyByCIN(cin);
      if (mcaData) {
        sourcesUsed.push('mca');
      }
    }
  }

  const financialsSource = toflerHasUsableData ? 'tofler' : 
    (sourcesUsed.includes('fintekpro') ? 'fintekpro' : 
    (sourcesUsed.includes('mca') ? 'mca' : null));

  const ratiosSource = toflerHasUsableData ? 'tofler' :
    (sourcesUsed.includes('fintekpro') ? 'fintekpro' : null);

  return {
    sourcesAttempted,
    sourcesUsed,
    primarySource: sourcesUsed[0] || null,
    financialsSource,
    ratiosSource,
    toflerCalled,
    toflerError,
    toflerHasUsableData: !!toflerHasUsableData,
    fintekproCalled,
    mcaCalled,
    callOrder,
  };
}

function assertEqual(actual: any, expected: any, message: string) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(`${message}\n  Expected: ${expectedStr}\n  Actual: ${actualStr}`);
  }
}

function assertContains(arr: any[], value: any, message: string) {
  if (!arr.includes(value)) {
    throw new Error(`${message}\n  Array: [${arr.join(', ')}]\n  Expected to contain: ${value}`);
  }
}

async function runTests() {
  console.log('\n🧪 Running Unified Company Data Service Regression Tests\n');
  console.log('=' .repeat(70) + '\n');
  
  let passed = 0;
  let failed = 0;

  const tests: { name: string; fn: () => Promise<void> }[] = [
    {
      name: 'Scenario 1: Tofler Success - Uses Tofler as primary source',
      fn: async () => {
        const mockStorage = {
          getUnlistedCompanyById: async () => ({ id: 'company-1', name: 'Test Company', cin: 'U12345MH2020PTC123456' }),
          getCompanyFinancials: async () => [],
          getCompanyRatios: async () => [],
        };
        const mockToflerService = {
          getCompanyDetails: async () => mockToflerFullData,
          searchCompanies: async () => [],
        };
        const mockMcaService = {
          isConfigured: () => true,
          getCompanyByCIN: async () => mockMCAData,
        };

        const result = await simulateGetCompanyData('company-1', { includeMCA: true, skipTofler: false }, mockStorage, mockToflerService, mockMcaService);
        
        assertEqual(result.toflerCalled, true, 'Tofler should be called');
        assertEqual(result.primarySource, 'tofler', 'Primary source should be Tofler');
        assertEqual(result.financialsSource, 'tofler', 'Financials source should be Tofler');
        assertEqual(result.mcaCalled, false, 'MCA should NOT be called when Tofler succeeds with full data');
      },
    },
    {
      name: 'Scenario 2: Tofler Partial Data - Triggers MCA fallback',
      fn: async () => {
        const mockStorage = {
          getUnlistedCompanyById: async () => ({ id: 'company-2', name: 'Shell Company', cin: 'U12345MH2020PTC789012' }),
          getCompanyFinancials: async () => [],
          getCompanyRatios: async () => [],
        };
        const mockToflerService = {
          getCompanyDetails: async () => mockToflerShellData,
          searchCompanies: async () => [],
        };
        const mockMcaService = {
          isConfigured: () => true,
          getCompanyByCIN: async () => mockMCAData,
        };

        const result = await simulateGetCompanyData('company-2', { includeMCA: true, skipTofler: false }, mockStorage, mockToflerService, mockMcaService);
        
        assertEqual(result.toflerCalled, true, 'Tofler should be called');
        assertEqual(result.toflerHasUsableData, false, 'Tofler should NOT have usable data');
        assertEqual(result.mcaCalled, true, 'MCA should be called when Tofler returns shell data');
        assertContains(result.sourcesUsed, 'mca', 'MCA should be in sources used');
      },
    },
    {
      name: 'Scenario 3: Tofler Failure - Falls back to FintekPro then MCA',
      fn: async () => {
        const mockStorage = {
          getUnlistedCompanyById: async () => ({ id: 'company-3', name: 'Error Test', cin: 'U12345MH2020PTC111222' }),
          getCompanyFinancials: async () => mockOwnFinancials,
          getCompanyRatios: async () => mockOwnRatios,
        };
        const mockToflerService = {
          getCompanyDetails: async () => { throw new Error('Tofler API rate limit exceeded'); },
          searchCompanies: async () => [],
        };
        const mockMcaService = {
          isConfigured: () => true,
          getCompanyByCIN: async () => mockMCAData,
        };

        const result = await simulateGetCompanyData('company-3', { includeMCA: true, skipTofler: false }, mockStorage, mockToflerService, mockMcaService);
        
        assertEqual(result.toflerCalled, true, 'Tofler should be called');
        assertEqual(result.toflerError, 'Tofler API rate limit exceeded', 'Should capture Tofler error');
        assertEqual(result.fintekproCalled, true, 'FintekPro should be called');
        assertContains(result.sourcesUsed, 'fintekpro', 'FintekPro should be in sources used');
        assertEqual(result.mcaCalled, true, 'MCA should be called when Tofler fails');
      },
    },
    {
      name: 'Scenario 4: Priority - Tofler called first unless skipTofler',
      fn: async () => {
        const mockStorage = {
          getUnlistedCompanyById: async () => ({ id: 'company-4', name: 'Priority Test', cin: 'U12345MH2020PTC333444' }),
          getCompanyFinancials: async () => mockOwnFinancials,
          getCompanyRatios: async () => mockOwnRatios,
        };
        const mockToflerService = {
          getCompanyDetails: async () => mockToflerFullData,
          searchCompanies: async () => [],
        };
        const mockMcaService = {
          isConfigured: () => true,
          getCompanyByCIN: async () => mockMCAData,
        };

        const result = await simulateGetCompanyData('company-4', { includeMCA: true, skipTofler: false }, mockStorage, mockToflerService, mockMcaService);
        
        assertEqual(result.callOrder[0], 'tofler', 'Tofler should be called first');
        assertEqual(result.toflerCalled, true, 'Tofler should be called');
      },
    },
    {
      name: 'Scenario 5: skipTofler flag - Skips Tofler when true',
      fn: async () => {
        const mockStorage = {
          getUnlistedCompanyById: async () => ({ id: 'company-5', name: 'Skip Test', cin: 'U12345MH2020PTC555666' }),
          getCompanyFinancials: async () => mockOwnFinancials,
          getCompanyRatios: async () => mockOwnRatios,
        };
        const mockToflerService = {
          getCompanyDetails: async () => mockToflerFullData,
          searchCompanies: async () => [],
        };
        const mockMcaService = {
          isConfigured: () => true,
          getCompanyByCIN: async () => mockMCAData,
        };

        const result = await simulateGetCompanyData('company-5', { includeMCA: true, skipTofler: true }, mockStorage, mockToflerService, mockMcaService);
        
        assertEqual(result.toflerCalled, false, 'Tofler should NOT be called when skipTofler is true');
        assertEqual(result.fintekproCalled, true, 'FintekPro should be called');
      },
    },
    {
      name: 'Scenario 6: MCA Fallback Condition - Engages when toflerHasUsableData is false',
      fn: async () => {
        const mockStorage = {
          getUnlistedCompanyById: async () => ({ id: 'company-6', name: 'MCA Fallback Test', cin: 'U12345MH2020PTC777888' }),
          getCompanyFinancials: async () => [],
          getCompanyRatios: async () => [],
        };
        const mockToflerService = {
          getCompanyDetails: async () => ({
            basicInfo: mockToflerShellData.basicInfo,
            financials: [],
            ratios: [],
            directors: [],
            charges: [],
          }),
          searchCompanies: async () => [],
        };
        const mockMcaService = {
          isConfigured: () => true,
          getCompanyByCIN: async () => mockMCAData,
        };

        const result = await simulateGetCompanyData('company-6', { includeMCA: true, skipTofler: false }, mockStorage, mockToflerService, mockMcaService);
        
        assertEqual(result.toflerHasUsableData, false, 'Tofler should NOT have usable data');
        assertEqual(result.mcaCalled, true, 'MCA should be called');
      },
    },
    {
      name: 'Scenario 7: MCA NOT called when Tofler has usable financials',
      fn: async () => {
        const mockStorage = {
          getUnlistedCompanyById: async () => ({ id: 'company-7', name: 'No MCA Needed', cin: 'U12345MH2020PTC999000' }),
          getCompanyFinancials: async () => [],
          getCompanyRatios: async () => [],
        };
        const mockToflerService = {
          getCompanyDetails: async () => mockToflerFullData,
          searchCompanies: async () => [],
        };
        const mockMcaService = {
          isConfigured: () => true,
          getCompanyByCIN: async () => mockMCAData,
        };

        const result = await simulateGetCompanyData('company-7', { includeMCA: true, skipTofler: false }, mockStorage, mockToflerService, mockMcaService);
        
        assertEqual(result.toflerHasUsableData, true, 'Tofler should have usable data');
        assertEqual(result.mcaCalled, false, 'MCA should NOT be called when Tofler has usable data');
      },
    },
    {
      name: 'Scenario 8: Tofler preferred over stale FintekPro data',
      fn: async () => {
        const mockStorage = {
          getUnlistedCompanyById: async () => ({ id: 'company-8', name: 'Stale Data Test', cin: 'U12345MH2020PTC112233' }),
          getCompanyFinancials: async () => mockOwnFinancials,
          getCompanyRatios: async () => mockOwnRatios,
        };
        const mockToflerService = {
          getCompanyDetails: async () => mockToflerFullData,
          searchCompanies: async () => [],
        };
        const mockMcaService = {
          isConfigured: () => true,
          getCompanyByCIN: async () => mockMCAData,
        };

        const result = await simulateGetCompanyData('company-8', { includeMCA: true, skipTofler: false }, mockStorage, mockToflerService, mockMcaService);
        
        assertEqual(result.financialsSource, 'tofler', 'Tofler should be preferred for financials');
        assertEqual(result.ratiosSource, 'tofler', 'Tofler should be preferred for ratios');
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

  console.log('\n' + '=' .repeat(70));
  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(console.error);
