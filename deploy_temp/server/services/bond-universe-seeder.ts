import { db } from '../db';
import { corporateBonds } from '@shared/schema';
import { sql, eq } from 'drizzle-orm';
import { fixedIncomeStatusEngine } from './fixed-income-status-engine';

const ISSUERS = [
  { name: 'HDFC Ltd', sector: 'Financial Services', industry: 'NBFC', rating: 'AAA' },
  { name: 'ICICI Bank', sector: 'Financial Services', industry: 'Banking', rating: 'AAA' },
  { name: 'SBI', sector: 'Financial Services', industry: 'Banking', rating: 'AAA' },
  { name: 'LIC Housing Finance', sector: 'Financial Services', industry: 'NBFC', rating: 'AAA' },
  { name: 'Bajaj Finance', sector: 'Financial Services', industry: 'NBFC', rating: 'AAA' },
  { name: 'Mahindra Finance', sector: 'Financial Services', industry: 'NBFC', rating: 'AA+' },
  { name: 'Tata Capital', sector: 'Financial Services', industry: 'NBFC', rating: 'AAA' },
  { name: 'Kotak Mahindra', sector: 'Financial Services', industry: 'Banking', rating: 'AAA' },
  { name: 'Axis Bank', sector: 'Financial Services', industry: 'Banking', rating: 'AAA' },
  { name: 'IRFC', sector: 'Infrastructure', industry: 'Railways', rating: 'AAA' },
  { name: 'NHAI', sector: 'Infrastructure', industry: 'Roads', rating: 'AAA' },
  { name: 'RECL', sector: 'Infrastructure', industry: 'Power', rating: 'AAA' },
  { name: 'PFC', sector: 'Infrastructure', industry: 'Power', rating: 'AAA' },
  { name: 'NTPC', sector: 'Energy', industry: 'Power Generation', rating: 'AAA' },
  { name: 'Reliance Industries', sector: 'Conglomerate', industry: 'Energy', rating: 'AAA' },
  { name: 'Tata Steel', sector: 'Manufacturing', industry: 'Steel', rating: 'AA' },
  { name: 'L&T', sector: 'Infrastructure', industry: 'Construction', rating: 'AAA' },
  { name: 'Adani Ports', sector: 'Infrastructure', industry: 'Ports', rating: 'AA+' },
  { name: 'Bharti Airtel', sector: 'Telecom', industry: 'Telecom Services', rating: 'AA+' },
  { name: 'Infosys', sector: 'Technology', industry: 'IT Services', rating: 'AAA' },
  { name: 'HCL Technologies', sector: 'Technology', industry: 'IT Services', rating: 'AA+' },
  { name: 'Wipro', sector: 'Technology', industry: 'IT Services', rating: 'AA+' },
  { name: 'Godrej Properties', sector: 'Real Estate', industry: 'Developers', rating: 'AA' },
  { name: 'DLF', sector: 'Real Estate', industry: 'Developers', rating: 'AA' },
  { name: 'Sun Pharma', sector: 'Healthcare', industry: 'Pharmaceuticals', rating: 'AA+' },
  { name: 'Dr Reddys', sector: 'Healthcare', industry: 'Pharmaceuticals', rating: 'AA' },
  { name: 'Hero MotoCorp', sector: 'Automobile', industry: 'Two Wheelers', rating: 'AAA' },
  { name: 'Maruti Suzuki', sector: 'Automobile', industry: 'Cars', rating: 'AAA' },
  { name: 'Tata Motors', sector: 'Automobile', industry: 'Commercial Vehicles', rating: 'AA' },
  { name: 'Shriram Transport', sector: 'Financial Services', industry: 'NBFC', rating: 'AA+' },
  { name: 'Muthoot Finance', sector: 'Financial Services', industry: 'NBFC', rating: 'AA+' },
  { name: 'Cholamandalam', sector: 'Financial Services', industry: 'NBFC', rating: 'AA+' },
  { name: 'Sundaram Finance', sector: 'Financial Services', industry: 'NBFC', rating: 'AAA' },
  { name: 'IIFL Finance', sector: 'Financial Services', industry: 'NBFC', rating: 'AA' },
  { name: 'Piramal Enterprises', sector: 'Conglomerate', industry: 'Diversified', rating: 'AA' },
  { name: 'JM Financial', sector: 'Financial Services', industry: 'Investment Banking', rating: 'AA' },
  { name: 'ONGC', sector: 'Energy', industry: 'Oil & Gas', rating: 'AAA' },
  { name: 'Indian Oil Corp', sector: 'Energy', industry: 'Oil & Gas', rating: 'AAA' },
  { name: 'BPCL', sector: 'Energy', industry: 'Oil & Gas', rating: 'AAA' },
  { name: 'GAIL', sector: 'Energy', industry: 'Gas Distribution', rating: 'AAA' },
  { name: 'Coal India', sector: 'Mining', industry: 'Coal', rating: 'AAA' },
  { name: 'SAIL', sector: 'Manufacturing', industry: 'Steel', rating: 'AA' },
  { name: 'JSW Steel', sector: 'Manufacturing', industry: 'Steel', rating: 'AA+' },
  { name: 'Vedanta', sector: 'Mining', industry: 'Metals', rating: 'AA' },
  { name: 'Hindalco', sector: 'Manufacturing', industry: 'Aluminum', rating: 'AA+' },
  { name: 'Ultratech Cement', sector: 'Manufacturing', industry: 'Cement', rating: 'AAA' },
  { name: 'ACC', sector: 'Manufacturing', industry: 'Cement', rating: 'AA+' },
  { name: 'Ambuja Cement', sector: 'Manufacturing', industry: 'Cement', rating: 'AA+' },
  { name: 'Shree Cement', sector: 'Manufacturing', industry: 'Cement', rating: 'AA+' },
  { name: 'ITC', sector: 'FMCG', industry: 'Tobacco & FMCG', rating: 'AAA' },
  { name: 'HUL', sector: 'FMCG', industry: 'Consumer Goods', rating: 'AAA' },
  { name: 'Nestle India', sector: 'FMCG', industry: 'Food & Beverages', rating: 'AAA' },
  { name: 'Asian Paints', sector: 'Manufacturing', industry: 'Paints', rating: 'AAA' },
  { name: 'Pidilite', sector: 'Manufacturing', industry: 'Chemicals', rating: 'AAA' },
  { name: 'Titan Company', sector: 'Consumer', industry: 'Retail', rating: 'AAA' },
  { name: 'Avenue Supermarts', sector: 'Consumer', industry: 'Retail', rating: 'AA+' },
  { name: 'Trent', sector: 'Consumer', industry: 'Retail', rating: 'AA' },
  { name: 'Eternal', sector: 'Technology', industry: 'Food Delivery', rating: 'A+' },
  { name: 'Paytm', sector: 'Technology', industry: 'Fintech', rating: 'A' },
  { name: 'PolicyBazaar', sector: 'Technology', industry: 'Insurtech', rating: 'A' },
  { name: 'Nazara Technologies', sector: 'Technology', industry: 'Gaming', rating: 'A' },
  { name: 'Delhivery', sector: 'Technology', industry: 'Logistics', rating: 'A' },
  { name: 'Lenskart', sector: 'Consumer', industry: 'Eyewear', rating: 'A' },
  { name: 'CarDekho', sector: 'Technology', industry: 'Auto Tech', rating: 'BBB+' },
  { name: 'OYO Rooms', sector: 'Technology', industry: 'Hospitality', rating: 'BBB' },
];

const BOND_TYPES = ['corporate_bond', 'ncd', 'debenture', 'tax_free_bond', 'infrastructure_bond'];
const COUPON_TYPES = ['fixed', 'floating', 'zero_coupon'];
const COUPON_FREQUENCIES = ['annual', 'semi_annual', 'quarterly', 'monthly'];
const RATING_AGENCIES = ['CRISIL', 'ICRA', 'CARE', 'India Ratings', 'Fitch'];

function generateISIN(): string {
  const prefix = 'INE';
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 9; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return prefix + code;
}

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

function generateBond(index: number): any {
  const issuer = ISSUERS[index % ISSUERS.length];
  const bondType = BOND_TYPES[Math.floor(Math.random() * BOND_TYPES.length)];
  const couponType = COUPON_TYPES[Math.floor(Math.random() * COUPON_TYPES.length)];
  const couponFrequency = COUPON_FREQUENCIES[Math.floor(Math.random() * COUPON_FREQUENCIES.length)];
  const ratingAgency = RATING_AGENCIES[Math.floor(Math.random() * RATING_AGENCIES.length)];
  
  const now = new Date();
  const issueDate = randomDate(new Date(now.getFullYear() - 5, 0, 1), now);
  const tenorYears = Math.floor(Math.random() * 15) + 1;
  const maturityDate = new Date(issueDate);
  maturityDate.setFullYear(maturityDate.getFullYear() + tenorYears);
  
  const faceValue = [100, 1000, 10000, 100000][Math.floor(Math.random() * 4)];
  const couponRate = couponType === 'zero_coupon' ? 0 : (6 + Math.random() * 6);
  const yieldToMaturity = couponRate + (Math.random() - 0.5) * 2;
  const currentPrice = faceValue * (0.85 + Math.random() * 0.3);
  
  const isListed = Math.random() > 0.3;
  const liquidityScore = isListed ? Math.floor(40 + Math.random() * 60) : Math.floor(10 + Math.random() * 40);
  const bidAskSpread = isListed ? (0.2 + Math.random() * 1.5) : (1.5 + Math.random() * 3);
  
  const regulatoryEligibility = 
    issuer.rating === 'AAA' || issuer.rating === 'AA+' ? 'retail' :
    issuer.rating === 'AA' || issuer.rating === 'AA-' ? (Math.random() > 0.5 ? 'retail' : 'hni_only') :
    issuer.rating === 'A+' || issuer.rating === 'A' ? (Math.random() > 0.7 ? 'hni_only' : 'qib_only') :
    'qib_only';
  
  const isCallable = Math.random() > 0.7;
  const isPuttable = Math.random() > 0.85;
  const securityType = ['senior_secured', 'subordinated', 'unsecured'][Math.floor(Math.random() * 3)];
  const structureComplexity = 
    1 + (isCallable ? 1 : 0) + (isPuttable ? 1 : 0) + 
    (securityType === 'subordinated' ? 1 : 0) + (couponType === 'floating' ? 1 : 0);
  
  const lastTradedDate = isListed 
    ? randomDate(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), now)
    : randomDate(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), now);
  
  let instrumentStatus: 'SELLABLE' | 'VISIBLE' | 'HIDDEN' = 'HIDDEN';
  const statusReasons: string[] = [];
  
  if (!isListed) {
    instrumentStatus = 'HIDDEN';
    statusReasons.push('Unlisted instrument');
  } else if (regulatoryEligibility !== 'retail') {
    instrumentStatus = 'VISIBLE';
    statusReasons.push(`Regulatory eligibility: ${regulatoryEligibility}`);
  } else if (liquidityScore < 60) {
    instrumentStatus = 'VISIBLE';
    statusReasons.push(`Low liquidity score: ${liquidityScore}`);
  } else if (bidAskSpread > 1.25) {
    instrumentStatus = 'VISIBLE';
    statusReasons.push(`High bid-ask spread: ${bidAskSpread.toFixed(2)}%`);
  } else if (!['AAA', 'AA+', 'AA', 'AA-', 'A+'].includes(issuer.rating)) {
    instrumentStatus = 'VISIBLE';
    statusReasons.push(`Credit rating below threshold: ${issuer.rating}`);
  } else if (structureComplexity > 3) {
    instrumentStatus = 'VISIBLE';
    statusReasons.push(`High structure complexity: ${structureComplexity}`);
  } else {
    instrumentStatus = 'SELLABLE';
  }

  return {
    isin: generateISIN(),
    securityCode: `BSE${100000 + index}`,
    bondName: `${issuer.name} ${bondType === 'ncd' ? 'NCD' : 'Bond'} Series ${Math.floor(Math.random() * 100) + 1} ${maturityDate.getFullYear()}`,
    issuer: issuer.name,
    bondType,
    faceValue: faceValue.toString(),
    couponType,
    couponRate: couponRate.toFixed(4),
    couponFrequency,
    issueDate: issueDate.toISOString().split('T')[0],
    maturityDate: maturityDate.toISOString().split('T')[0],
    tenorYears: tenorYears.toString(),
    issuePrice: faceValue.toString(),
    currentPrice: currentPrice.toFixed(4),
    yieldToMaturity: yieldToMaturity.toFixed(4),
    tradingStatus: 'active',
    minimumLotSize: 1,
    minimumInvestment: (faceValue * (bondType === 'ncd' ? 10 : 1)).toString(),
    isCallable,
    isPuttable,
    secured: securityType !== 'unsecured',
    securityType,
    creditRating: issuer.rating,
    ratingAgency,
    ratingDate: randomDate(new Date(now.getFullYear() - 1, 0, 1), now).toISOString().split('T')[0],
    outlookStatus: ['stable', 'positive', 'negative'][Math.floor(Math.random() * 3)],
    lastTradedPrice: currentPrice.toFixed(4),
    lastTradedDate: lastTradedDate.toISOString().split('T')[0],
    volume: Math.floor(Math.random() * 10000),
    turnover: (Math.random() * 1000000).toFixed(2),
    issuerSector: issuer.sector,
    issuerIndustry: issuer.industry,
    taxStatus: bondType === 'tax_free_bond' ? 'tax_free' : 'taxable',
    dataSource: 'seed_script',
    instrumentStatus,
    isListed,
    liquidityScore,
    ratingCurrent: issuer.rating.substring(0, 10),
    ratingTrend: ['up', 'stable', 'down'][Math.floor(Math.random() * 3)],
    structureComplexity,
    regulatoryEligibility,
    bidAskSpread: bidAskSpread.toFixed(2),
    statusReason: statusReasons.join('; ') || 'All gates passed',
    statusLastUpdated: new Date(),
  };
}

export async function seedBondUniverse(count: number = 8000): Promise<{
  inserted: number;
  sellable: number;
  visible: number;
  hidden: number;
  errors: string[];
}> {
  console.log(`[BondUniverseSeeder] Starting to seed ${count} bonds...`);
  
  const errors: string[] = [];
  let inserted = 0;
  let sellable = 0;
  let visible = 0;
  let hidden = 0;
  
  const batchSize = 100;
  const batches = Math.ceil(count / batchSize);
  
  for (let batch = 0; batch < batches; batch++) {
    const bonds = [];
    const startIdx = batch * batchSize;
    const endIdx = Math.min(startIdx + batchSize, count);
    
    for (let i = startIdx; i < endIdx; i++) {
      bonds.push(generateBond(i));
    }
    
    try {
      await db.insert(corporateBonds).values(bonds).onConflictDoNothing();
      
      for (const bond of bonds) {
        inserted++;
        if (bond.instrumentStatus === 'SELLABLE') sellable++;
        else if (bond.instrumentStatus === 'VISIBLE') visible++;
        else hidden++;
      }
      
      if ((batch + 1) % 10 === 0) {
        console.log(`[BondUniverseSeeder] Progress: ${inserted}/${count} bonds inserted`);
      }
    } catch (error) {
      errors.push(`Batch ${batch} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  console.log(`[BondUniverseSeeder] Seeding complete: ${inserted} inserted`);
  console.log(`[BondUniverseSeeder] Status distribution: ${sellable} SELLABLE, ${visible} VISIBLE, ${hidden} HIDDEN`);
  
  return { inserted, sellable, visible, hidden, errors };
}

export async function getBondUniverseStats(): Promise<{
  total: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
  bySector: Record<string, number>;
  byRating: Record<string, number>;
}> {
  const statusResult = await db.execute(sql`
    SELECT instrument_status, COUNT(*) as count
    FROM corporate_bonds
    GROUP BY instrument_status
  `);
  
  const typeResult = await db.execute(sql`
    SELECT bond_type, COUNT(*) as count
    FROM corporate_bonds
    GROUP BY bond_type
  `);
  
  const sectorResult = await db.execute(sql`
    SELECT issuer_sector, COUNT(*) as count
    FROM corporate_bonds
    GROUP BY issuer_sector
    ORDER BY count DESC
    LIMIT 10
  `);
  
  const ratingResult = await db.execute(sql`
    SELECT credit_rating, COUNT(*) as count
    FROM corporate_bonds
    GROUP BY credit_rating
    ORDER BY count DESC
  `);
  
  const totalResult = await db.execute(sql`SELECT COUNT(*) as count FROM corporate_bonds`);
  
  return {
    total: parseInt(totalResult.rows[0]?.count as string || '0'),
    byStatus: Object.fromEntries(statusResult.rows.map(r => [r.instrument_status, parseInt(r.count as string)])),
    byType: Object.fromEntries(typeResult.rows.map(r => [r.bond_type, parseInt(r.count as string)])),
    bySector: Object.fromEntries(sectorResult.rows.map(r => [r.issuer_sector || 'Unknown', parseInt(r.count as string)])),
    byRating: Object.fromEntries(ratingResult.rows.map(r => [r.credit_rating || 'Unrated', parseInt(r.count as string)])),
  };
}
