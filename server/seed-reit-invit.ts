import { db } from './db';
import { reits, invits, unlistedCompanies } from '@shared/schema';
import { eq, sql } from 'drizzle-orm';
import { fileURLToPath } from 'url';

interface ReitData {
  symbol: string;
  name: string;
  sponsor?: string;
  manager?: string;
  isinCode?: string;
  sector: string;
  propertyType?: string;
  geography?: string;
  exchange: string;
  listingDate?: Date;
  riskLevel?: string;
  minimumInvestment?: number;
  lotSize?: number;
  faceValue?: number;
}

interface InvitData {
  symbol: string;
  name: string;
  sponsor?: string;
  manager?: string;
  isinCode?: string;
  sector: string;
  infrastructureType?: string;
  geography?: string;
  exchange: string;
  listingDate?: Date;
  riskLevel?: string;
  minimumInvestment?: number;
  lotSize?: number;
  faceValue?: number;
}

interface UnlistedReitInvitData {
  name: string;
  cin?: string;
  sector: string;
  industry: string;
  listingStage: string;
  status: string;
}

const LISTED_REITS: ReitData[] = [
  {
    symbol: 'EMBASSY',
    name: 'Embassy Office Parks REIT',
    sponsor: 'Blackstone Group & Embassy Group',
    manager: 'Embassy Office Parks Management Services',
    isinCode: 'INE0LYH01012',
    sector: 'office',
    propertyType: 'commercial',
    geography: 'Bengaluru, Mumbai, Pune, NCR',
    exchange: 'NSE',
    listingDate: new Date('2019-04-01'),
    riskLevel: 'moderate',
    minimumInvestment: 10000,
    lotSize: 1,
    faceValue: 300,
  },
  {
    symbol: 'MINDSPACE',
    name: 'Mindspace Business Parks REIT',
    sponsor: 'K Raheja Corp & Blackstone',
    manager: 'Mindspace Business Parks REIT',
    isinCode: 'INE0CCU01017',
    sector: 'office',
    propertyType: 'commercial',
    geography: 'Mumbai, Hyderabad, Pune, Chennai',
    exchange: 'NSE',
    listingDate: new Date('2020-08-07'),
    riskLevel: 'moderate',
    minimumInvestment: 10000,
    lotSize: 1,
    faceValue: 275,
  },
  {
    symbol: 'BROOKFIELD',
    name: 'Brookfield India Real Estate Trust',
    sponsor: 'Brookfield Asset Management',
    manager: 'Brookprop Management Services',
    isinCode: 'INE0JGT01014',
    sector: 'office',
    propertyType: 'commercial',
    geography: 'Mumbai, Gurugram, Noida, Kolkata',
    exchange: 'NSE',
    listingDate: new Date('2021-02-17'),
    riskLevel: 'moderate',
    minimumInvestment: 10000,
    lotSize: 1,
    faceValue: 275,
  },
  {
    symbol: 'NEXUSSELECT',
    name: 'Nexus Select Trust',
    sponsor: 'Blackstone',
    manager: 'Nexus Select Mall Management',
    isinCode: 'INE0OL401014',
    sector: 'retail',
    propertyType: 'retail_malls',
    geography: 'Pan India (17 malls across 14 cities)',
    exchange: 'NSE',
    listingDate: new Date('2023-05-19'),
    riskLevel: 'moderate',
    minimumInvestment: 10000,
    lotSize: 1,
    faceValue: 100,
  },
];

const LISTED_INVITS: InvitData[] = [
  {
    symbol: 'INDIGRID',
    name: 'India Grid Trust',
    sponsor: 'Sterlite Power Grid Ventures',
    manager: 'IndiGrid Investment Managers',
    isinCode: 'INE219X01015',
    sector: 'power',
    infrastructureType: 'transmission',
    geography: 'Pan India',
    exchange: 'NSE',
    listingDate: new Date('2017-06-06'),
    riskLevel: 'moderate',
    minimumInvestment: 10000,
    lotSize: 1,
    faceValue: 100,
  },
  {
    symbol: 'IRB',
    name: 'IRB InvIT Fund',
    sponsor: 'IRB Infrastructure Developers',
    manager: 'IRB InvIT Fund',
    isinCode: 'INE183W01010',
    sector: 'roads',
    infrastructureType: 'toll_roads',
    geography: 'Maharashtra, Gujarat, Rajasthan, Karnataka',
    exchange: 'NSE',
    listingDate: new Date('2017-05-17'),
    riskLevel: 'moderate',
    minimumInvestment: 10000,
    lotSize: 1,
    faceValue: 100,
  },
  {
    symbol: 'POWERGRID',
    name: 'PowerGrid Infrastructure Investment Trust',
    sponsor: 'Power Grid Corporation of India',
    manager: 'PowerGrid InvIT',
    isinCode: 'INE0DH401018',
    sector: 'power',
    infrastructureType: 'transmission',
    geography: 'Pan India',
    exchange: 'NSE',
    listingDate: new Date('2021-05-14'),
    riskLevel: 'low',
    minimumInvestment: 10000,
    lotSize: 1,
    faceValue: 100,
  },
  {
    symbol: 'NHIT',
    name: 'National Highways Infra Trust',
    sponsor: 'NHAI (National Highways Authority of India)',
    manager: 'NHAI InvIT',
    isinCode: 'INE0FD601014',
    sector: 'roads',
    infrastructureType: 'toll_roads',
    geography: 'Pan India (National Highways)',
    exchange: 'NSE',
    listingDate: new Date('2021-11-08'),
    riskLevel: 'low',
    minimumInvestment: 10000,
    lotSize: 1,
    faceValue: 100,
  },
  {
    symbol: 'JIOINVIT',
    name: 'Data Infrastructure Trust (Jio Digital Fibre)',
    sponsor: 'Reliance Industries Limited',
    manager: 'Jio Infrastructure Management',
    isinCode: 'INE0QN001014',
    sector: 'telecom',
    infrastructureType: 'fiber_optic',
    geography: 'Pan India',
    exchange: 'NSE',
    listingDate: new Date('2021-03-15'),
    riskLevel: 'moderate',
    minimumInvestment: 100000,
    lotSize: 1,
    faceValue: 100,
  },
];

const UNLISTED_REITS: UnlistedReitInvitData[] = [
  {
    name: '360 ONE Real Estate Investment Trust',
    sector: 'Real Estate',
    industry: 'REIT - Office',
    listingStage: 'unlisted',
    status: 'active',
  },
  {
    name: 'Bagmane Prime Office REIT',
    sector: 'Real Estate',
    industry: 'REIT - Office',
    listingStage: 'pre_ipo',
    status: 'active',
  },
  {
    name: 'Office Realty Trust',
    sector: 'Real Estate',
    industry: 'REIT - Office',
    listingStage: 'unlisted',
    status: 'active',
  },
];

const UNLISTED_INVITS: UnlistedReitInvitData[] = [
  {
    name: 'AMPIN Infrastructure Trust',
    sector: 'Infrastructure',
    industry: 'InvIT - Renewable Energy',
    listingStage: 'unlisted',
    status: 'active',
  },
  {
    name: 'ANANTAM HIGHWAYS TRUST',
    sector: 'Infrastructure',
    industry: 'InvIT - Roads & Highways',
    listingStage: 'unlisted',
    status: 'active',
  },
  {
    name: 'Anzen India Energy Yield Plus Trust',
    sector: 'Infrastructure',
    industry: 'InvIT - Energy',
    listingStage: 'unlisted',
    status: 'active',
  },
  {
    name: 'ATHAANG INFRASTRUCTURE TRUST',
    sector: 'Infrastructure',
    industry: 'InvIT - Mixed Infrastructure',
    listingStage: 'unlisted',
    status: 'active',
  },
  {
    name: 'CAPITAL INFRA TRUST',
    sector: 'Infrastructure',
    industry: 'InvIT - Roads & Highways',
    listingStage: 'unlisted',
    status: 'active',
  },
  {
    name: 'Citius TransNet Investment Trust',
    sector: 'Infrastructure',
    industry: 'InvIT - Roads & Highways',
    listingStage: 'unlisted',
    status: 'active',
  },
  {
    name: 'Cube Highways Trust',
    sector: 'Infrastructure',
    industry: 'InvIT - Roads & Highways',
    listingStage: 'unlisted',
    status: 'active',
  },
  {
    name: 'Energy Infrastructure Trust',
    sector: 'Infrastructure',
    industry: 'InvIT - Energy',
    listingStage: 'unlisted',
    status: 'active',
  },
  {
    name: 'Indus Infra Trust',
    sector: 'Infrastructure',
    industry: 'InvIT - Roads & Highways',
    listingStage: 'unlisted',
    status: 'active',
  },
  {
    name: 'Intelligent Supply Chain Infrastructure Trust',
    sector: 'Infrastructure',
    industry: 'InvIT - Logistics & Warehousing',
    listingStage: 'unlisted',
    status: 'active',
  },
  {
    name: 'Interise Trust',
    sector: 'Infrastructure',
    industry: 'InvIT - Mixed Infrastructure',
    listingStage: 'unlisted',
    status: 'active',
  },
  {
    name: 'IRB Infrastructure Trust',
    sector: 'Infrastructure',
    industry: 'InvIT - Roads & Highways',
    listingStage: 'unlisted',
    status: 'active',
  },
  {
    name: 'Maple Infrastructure Trust',
    sector: 'Infrastructure',
    industry: 'InvIT - Roads & Highways',
    listingStage: 'unlisted',
    status: 'active',
  },
  {
    name: 'NDR InvIT Trust',
    sector: 'Infrastructure',
    industry: 'InvIT - Logistics & Warehousing',
    listingStage: 'unlisted',
    status: 'active',
  },
  {
    name: 'Nxt-Infra Trust',
    sector: 'Infrastructure',
    industry: 'InvIT - Mixed Infrastructure',
    listingStage: 'unlisted',
    status: 'active',
  },
  {
    name: 'Oriental InfraTrust',
    sector: 'Infrastructure',
    industry: 'InvIT - Roads & Highways',
    listingStage: 'unlisted',
    status: 'active',
  },
  {
    name: 'RAAJMARG INFRA INVESTMENT TRUST',
    sector: 'Infrastructure',
    industry: 'InvIT - Roads & Highways',
    listingStage: 'unlisted',
    status: 'active',
  },
  {
    name: 'Roadstar Infra Investment Trust',
    sector: 'Infrastructure',
    industry: 'InvIT - Roads & Highways',
    listingStage: 'unlisted',
    status: 'active',
  },
  {
    name: 'SchoolHouse InvIT',
    sector: 'Infrastructure',
    industry: 'InvIT - Education Infrastructure',
    listingStage: 'unlisted',
    status: 'active',
  },
  {
    name: 'Shrem InvIT',
    sector: 'Infrastructure',
    industry: 'InvIT - Roads & Highways',
    listingStage: 'unlisted',
    status: 'active',
  },
  {
    name: 'Tower Infrastructure Trust',
    sector: 'Infrastructure',
    industry: 'InvIT - Telecom Towers',
    listingStage: 'unlisted',
    status: 'active',
  },
  {
    name: 'Virescent Infrastructure Trust',
    sector: 'Infrastructure',
    industry: 'InvIT - Renewable Energy',
    listingStage: 'unlisted',
    status: 'active',
  },
  {
    name: 'Digital Fibre Infrastructure Trust',
    sector: 'Infrastructure',
    industry: 'InvIT - Telecom & Digital',
    listingStage: 'unlisted',
    status: 'active',
  },
];

export async function seedListedReits(): Promise<number> {
  let count = 0;
  
  for (const reit of LISTED_REITS) {
    try {
      const existing = await db.select().from(reits).where(eq(reits.symbol, reit.symbol));
      
      if (existing.length === 0) {
        await db.insert(reits).values({
          symbol: reit.symbol,
          name: reit.name,
          sponsor: reit.sponsor,
          manager: reit.manager,
          isinCode: reit.isinCode,
          sector: reit.sector,
          propertyType: reit.propertyType,
          geography: reit.geography,
          exchange: reit.exchange,
          listingDate: reit.listingDate,
          riskLevel: reit.riskLevel,
          minimumInvestment: reit.minimumInvestment?.toString(),
          lotSize: reit.lotSize,
          faceValue: reit.faceValue?.toString(),
          isActive: true,
        });
        console.log(`✅ Seeded listed REIT: ${reit.name}`);
        count++;
      } else {
        console.log(`⏭️ Listed REIT already exists: ${reit.name}`);
      }
    } catch (error) {
      console.error(`❌ Failed to seed REIT ${reit.name}:`, error);
    }
  }
  
  return count;
}

export async function seedListedInvits(): Promise<number> {
  let count = 0;
  
  for (const invit of LISTED_INVITS) {
    try {
      const existing = await db.select().from(invits).where(eq(invits.symbol, invit.symbol));
      
      if (existing.length === 0) {
        await db.insert(invits).values({
          symbol: invit.symbol,
          name: invit.name,
          sponsor: invit.sponsor,
          manager: invit.manager,
          isinCode: invit.isinCode,
          sector: invit.sector,
          infrastructureType: invit.infrastructureType,
          geography: invit.geography,
          exchange: invit.exchange,
          listingDate: invit.listingDate,
          riskLevel: invit.riskLevel,
          minimumInvestment: invit.minimumInvestment?.toString(),
          lotSize: invit.lotSize,
          faceValue: invit.faceValue?.toString(),
          isActive: true,
        });
        console.log(`✅ Seeded listed InvIT: ${invit.name}`);
        count++;
      } else {
        console.log(`⏭️ Listed InvIT already exists: ${invit.name}`);
      }
    } catch (error) {
      console.error(`❌ Failed to seed InvIT ${invit.name}:`, error);
    }
  }
  
  return count;
}

export async function seedUnlistedReitsInvits(): Promise<number> {
  let count = 0;
  
  const allUnlisted = [...UNLISTED_REITS, ...UNLISTED_INVITS];
  
  for (const item of allUnlisted) {
    try {
      const existing = await db.select().from(unlistedCompanies).where(eq(unlistedCompanies.name, item.name));
      
      if (existing.length === 0) {
        await db.insert(unlistedCompanies).values({
          name: item.name,
          sector: item.sector,
          industry: item.industry,
          listingStage: item.listingStage,
          status: item.status,
          pricingStatus: 'draft',
        });
        console.log(`✅ Seeded unlisted ${item.industry.includes('REIT') ? 'REIT' : 'InvIT'}: ${item.name}`);
        count++;
      } else {
        console.log(`⏭️ Unlisted already exists: ${item.name}`);
      }
    } catch (error) {
      console.error(`❌ Failed to seed unlisted ${item.name}:`, error);
    }
  }
  
  return count;
}

export async function seedAllReitsInvits(): Promise<{ listedReits: number; listedInvits: number; unlisted: number }> {
  console.log('🏢 Starting REIT/InvIT Seeding...\n');
  
  console.log('📈 Seeding Listed REITs...');
  const listedReits = await seedListedReits();
  
  console.log('\n🛣️ Seeding Listed InvITs...');
  const listedInvits = await seedListedInvits();
  
  console.log('\n🔒 Seeding Unlisted REITs & InvITs...');
  const unlisted = await seedUnlistedReitsInvits();
  
  console.log('\n📊 Seeding Summary:');
  console.log(`   Listed REITs: ${listedReits} added`);
  console.log(`   Listed InvITs: ${listedInvits} added`);
  console.log(`   Unlisted REITs/InvITs: ${unlisted} added`);
  console.log(`   Total: ${listedReits + listedInvits + unlisted} instruments\n`);
  
  return { listedReits, listedInvits, unlisted };
}

const isMainModule = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMainModule) {
  seedAllReitsInvits()
    .then((result) => {
      console.log('✅ REIT/InvIT seeding completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ REIT/InvIT seeding failed:', error);
      process.exit(1);
    });
}
