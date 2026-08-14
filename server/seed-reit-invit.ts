import { db } from "./db";
import { reits, invits, unlistedCompanies } from "@shared/schema";
import { eq } from "drizzle-orm";
import { fileURLToPath } from "url";
import { logger } from "./logger";


const SEBI_REIT_CIRCULAR = "SEBI/HO/IMD/IMD-I/DOF5/P/CIR/2025/177";
const SEBI_EFFECTIVE_DATE = new Date("2026-01-01");

/**
 * Auto-classify REIT by AMFI market-cap thresholds (SEBI circular Nov 28, 2025).
 * Large Cap >= ₹20,000 Cr | Mid Cap ₹5,000-19,999 Cr | Small Cap < ₹5,000 Cr
 */
function classifyReitByMarketCap(marketCapCr: number): "Large Cap" | "Mid Cap" | "Small Cap" {
	if (marketCapCr >= 20000) return "Large Cap";
	if (marketCapCr >= 5000) return "Mid Cap";
	return "Small Cap";
}

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
	// SEBI classification (per SEBI circular Nov 28, 2025 — effective Jan 1, 2026)
	sebiAssetClass: "equity";        // REITs are equity-related instruments
	amfiCapCategory: "Large Cap" | "Mid Cap" | "Small Cap"; // AMFI market-cap band
	equityIndexEligible: boolean;    // Eligible for equity indices from July 1, 2026
	sebiCircularRef: string;
	sebiEffectiveDate: Date;
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
	// SEBI classification (InvITs remain hybrid per SEBI circular Nov 28, 2025)
	sebiAssetClass: "hybrid";        // InvITs are hybrid instruments
	sebiCircularRef: string;
	sebiEffectiveDate: Date;
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
		symbol: "EMBASSY",
		name: "Embassy Office Parks REIT",
		sponsor: "Blackstone Group & Embassy Group",
		manager: "Embassy Office Parks Management Services",
		isinCode: "INE0LYH01012",
		sector: "office",
		propertyType: "commercial",
		geography: "Bengaluru, Mumbai, Pune, NCR",
		exchange: "NSE",
		listingDate: new Date("2019-04-01"),
		riskLevel: "moderate",
		minimumInvestment: 10000,
		lotSize: 1,
		faceValue: 300,
		// SEBI classification — equity, Large Cap (~₹34,000 Cr market cap)
		sebiAssetClass: "equity",
		amfiCapCategory: classifyReitByMarketCap(34000),
		equityIndexEligible: true,
		sebiCircularRef: SEBI_REIT_CIRCULAR,
		sebiEffectiveDate: SEBI_EFFECTIVE_DATE,
	},
	{
		symbol: "MINDSPACE",
		name: "Mindspace Business Parks REIT",
		sponsor: "K Raheja Corp & Blackstone",
		manager: "Mindspace Business Parks REIT",
		isinCode: "INE0CCU01017",
		sector: "office",
		propertyType: "commercial",
		geography: "Mumbai, Hyderabad, Pune, Chennai",
		exchange: "NSE",
		listingDate: new Date("2020-08-07"),
		riskLevel: "moderate",
		minimumInvestment: 10000,
		lotSize: 1,
		faceValue: 275,
		// SEBI classification — equity, Large Cap (~₹24,000 Cr market cap)
		sebiAssetClass: "equity",
		amfiCapCategory: classifyReitByMarketCap(24000),
		equityIndexEligible: true,
		sebiCircularRef: SEBI_REIT_CIRCULAR,
		sebiEffectiveDate: SEBI_EFFECTIVE_DATE,
	},
	{
		symbol: "BIRET",
		name: "Brookfield India Real Estate Trust",
		sponsor: "Brookfield Asset Management",
		manager: "Brookprop Management Services",
		isinCode: "INE0B8G01014",
		sector: "office",
		propertyType: "commercial",
		geography: "Mumbai, Gurugram, Noida, Kolkata",
		exchange: "NSE",
		listingDate: new Date("2021-02-17"),
		riskLevel: "moderate",
		minimumInvestment: 10000,
		lotSize: 1,
		faceValue: 275,
		// SEBI classification — equity, Mid Cap (~₹11,000 Cr market cap)
		sebiAssetClass: "equity",
		amfiCapCategory: classifyReitByMarketCap(11000),
		equityIndexEligible: true,
		sebiCircularRef: SEBI_REIT_CIRCULAR,
		sebiEffectiveDate: SEBI_EFFECTIVE_DATE,
	},
	{
		symbol: "NXST",
		name: "Nexus Select Trust",
		sponsor: "Blackstone",
		manager: "Nexus Select Mall Management",
		isinCode: "INE0CJ07019",
		sector: "retail",
		propertyType: "retail_malls",
		geography: "Pan India (17 malls across 14 cities)",
		exchange: "NSE",
		listingDate: new Date("2023-05-19"),
		riskLevel: "moderate",
		minimumInvestment: 10000,
		lotSize: 1,
		faceValue: 100,
		// SEBI classification — equity, Mid Cap (~₹14,000 Cr market cap)
		sebiAssetClass: "equity",
		amfiCapCategory: classifyReitByMarketCap(14000),
		equityIndexEligible: true,
		sebiCircularRef: SEBI_REIT_CIRCULAR,
		sebiEffectiveDate: SEBI_EFFECTIVE_DATE,
	},
];


const LISTED_INVITS: InvitData[] = [
	{
		symbol: "INDIGRID",
		name: "India Grid Trust",
		sponsor: "Sterlite Power Grid Ventures",
		manager: "IndiGrid Investment Managers",
		isinCode: "INE219X01015",
		sector: "power",
		infrastructureType: "transmission",
		geography: "Pan India",
		exchange: "NSE",
		listingDate: new Date("2017-06-06"),
		riskLevel: "moderate",
		minimumInvestment: 10000,
		lotSize: 1,
		faceValue: 100,
		sebiAssetClass: "hybrid",
		sebiCircularRef: SEBI_REIT_CIRCULAR,
		sebiEffectiveDate: SEBI_EFFECTIVE_DATE,
	},
	{
		symbol: "IRBINVIT",
		name: "IRB InvIT Fund",
		sponsor: "IRB Infrastructure Developers",
		manager: "IRB InvIT Fund",
		isinCode: "INE761T23010",
		sector: "roads",
		infrastructureType: "toll_roads",
		geography: "Maharashtra, Gujarat, Rajasthan, Karnataka",
		exchange: "NSE",
		listingDate: new Date("2017-05-17"),
		riskLevel: "moderate",
		minimumInvestment: 10000,
		lotSize: 1,
		faceValue: 100,
		sebiAssetClass: "hybrid",
		sebiCircularRef: SEBI_REIT_CIRCULAR,
		sebiEffectiveDate: SEBI_EFFECTIVE_DATE,
	},
	{
		symbol: "PGINFRA",
		name: "PowerGrid Infrastructure Investment Trust",
		sponsor: "Power Grid Corporation of India",
		manager: "PowerGrid InvIT",
		isinCode: "INE977K08013",
		sector: "power",
		infrastructureType: "transmission",
		geography: "Pan India",
		exchange: "NSE",
		listingDate: new Date("2021-05-14"),
		riskLevel: "low",
		minimumInvestment: 10000,
		lotSize: 1,
		faceValue: 100,
		sebiAssetClass: "hybrid",
		sebiCircularRef: SEBI_REIT_CIRCULAR,
		sebiEffectiveDate: SEBI_EFFECTIVE_DATE,
	},
	{
		symbol: "NHIT",
		name: "National Highways Infra Trust",
		sponsor: "NHAI (National Highways Authority of India)",
		manager: "NHAI InvIT",
		isinCode: "INE0FD601014",
		sector: "roads",
		infrastructureType: "toll_roads",
		geography: "Pan India (National Highways)",
		exchange: "NSE",
		listingDate: new Date("2021-11-08"),
		riskLevel: "low",
		minimumInvestment: 10000,
		lotSize: 1,
		faceValue: 100,
		sebiAssetClass: "hybrid",
		sebiCircularRef: SEBI_REIT_CIRCULAR,
		sebiEffectiveDate: SEBI_EFFECTIVE_DATE,
	},
	{
		symbol: "JIOINVIT",
		name: "Data Infrastructure Trust (Jio Digital Fibre)",
		sponsor: "Reliance Industries Limited",
		manager: "Jio Infrastructure Management",
		isinCode: "INE0QN001014",
		sector: "telecom",
		infrastructureType: "fiber_optic",
		geography: "Pan India",
		exchange: "NSE",
		listingDate: new Date("2021-03-15"),
		riskLevel: "moderate",
		minimumInvestment: 100000,
		lotSize: 1,
		faceValue: 100,
		sebiAssetClass: "hybrid",
		sebiCircularRef: SEBI_REIT_CIRCULAR,
		sebiEffectiveDate: SEBI_EFFECTIVE_DATE,
	},
	{
		symbol: "ORIENTGREEN",
		name: "Oriental Green InvIT",
		sponsor: "Oriental Green Power Company",
		manager: "Oriental Green InvIT Investment Manager",
		isinCode: "INE0M3H01016",
		sector: "power",
		infrastructureType: "renewable_energy",
		geography: "Tamil Nadu, Andhra Pradesh, Karnataka",
		exchange: "NSE",
		listingDate: new Date("2022-06-17"),
		riskLevel: "moderate",
		minimumInvestment: 10000,
		lotSize: 1,
		faceValue: 100,
		sebiAssetClass: "hybrid",
		sebiCircularRef: SEBI_REIT_CIRCULAR,
		sebiEffectiveDate: SEBI_EFFECTIVE_DATE,
	},
	{
		symbol: "BHINVIT",
		name: "Bharat Highway InvIT",
		sponsor: "National Highways Authority of India (NHAI)",
		manager: "BHIPL Investment Manager",
		isinCode: "INE0OND01014",
		sector: "roads",
		infrastructureType: "toll_roads",
		geography: "Pan India (National Highways)",
		exchange: "NSE",
		listingDate: new Date("2024-03-06"),
		riskLevel: "low",
		minimumInvestment: 10000,
		lotSize: 1,
		faceValue: 100,
		sebiAssetClass: "hybrid",
		sebiCircularRef: SEBI_REIT_CIRCULAR,
		sebiEffectiveDate: SEBI_EFFECTIVE_DATE,
	},
];


const UNLISTED_REITS: UnlistedReitInvitData[] = [
	{
		name: "360 ONE Real Estate Investment Trust",
		sector: "Real Estate",
		industry: "REIT - Office",
		listingStage: "unlisted",
		status: "active",
	},
	{
		name: "Bagmane Prime Office REIT",
		sector: "Real Estate",
		industry: "REIT - Office",
		listingStage: "pre_ipo",
		status: "active",
	},
	{
		name: "Office Realty Trust",
		sector: "Real Estate",
		industry: "REIT - Office",
		listingStage: "unlisted",
		status: "active",
	},
];

const UNLISTED_INVITS: UnlistedReitInvitData[] = [
	{
		name: "AMPIN Infrastructure Trust",
		sector: "Infrastructure",
		industry: "InvIT - Renewable Energy",
		listingStage: "unlisted",
		status: "active",
	},
	{
		name: "ANANTAM HIGHWAYS TRUST",
		sector: "Infrastructure",
		industry: "InvIT - Roads & Highways",
		listingStage: "unlisted",
		status: "active",
	},
	{
		name: "Anzen India Energy Yield Plus Trust",
		sector: "Infrastructure",
		industry: "InvIT - Energy",
		listingStage: "unlisted",
		status: "active",
	},
	{
		name: "ATHAANG INFRASTRUCTURE TRUST",
		sector: "Infrastructure",
		industry: "InvIT - Mixed Infrastructure",
		listingStage: "unlisted",
		status: "active",
	},
	{
		name: "CAPITAL INFRA TRUST",
		sector: "Infrastructure",
		industry: "InvIT - Roads & Highways",
		listingStage: "unlisted",
		status: "active",
	},
	{
		name: "Citius TransNet Investment Trust",
		sector: "Infrastructure",
		industry: "InvIT - Roads & Highways",
		listingStage: "unlisted",
		status: "active",
	},
	{
		name: "Cube Highways Trust",
		sector: "Infrastructure",
		industry: "InvIT - Roads & Highways",
		listingStage: "unlisted",
		status: "active",
	},
	{
		name: "Energy Infrastructure Trust",
		sector: "Infrastructure",
		industry: "InvIT - Energy",
		listingStage: "unlisted",
		status: "active",
	},
	{
		name: "Indus Infra Trust",
		sector: "Infrastructure",
		industry: "InvIT - Roads & Highways",
		listingStage: "unlisted",
		status: "active",
	},
	{
		name: "Intelligent Supply Chain Infrastructure Trust",
		sector: "Infrastructure",
		industry: "InvIT - Logistics & Warehousing",
		listingStage: "unlisted",
		status: "active",
	},
	{
		name: "Interise Trust",
		sector: "Infrastructure",
		industry: "InvIT - Mixed Infrastructure",
		listingStage: "unlisted",
		status: "active",
	},
	{
		name: "IRB Infrastructure Trust",
		sector: "Infrastructure",
		industry: "InvIT - Roads & Highways",
		listingStage: "unlisted",
		status: "active",
	},
	{
		name: "Maple Infrastructure Trust",
		sector: "Infrastructure",
		industry: "InvIT - Roads & Highways",
		listingStage: "unlisted",
		status: "active",
	},
	{
		name: "NDR InvIT Trust",
		sector: "Infrastructure",
		industry: "InvIT - Logistics & Warehousing",
		listingStage: "unlisted",
		status: "active",
	},
	{
		name: "Nxt-Infra Trust",
		sector: "Infrastructure",
		industry: "InvIT - Mixed Infrastructure",
		listingStage: "unlisted",
		status: "active",
	},
	{
		name: "Oriental InfraTrust",
		sector: "Infrastructure",
		industry: "InvIT - Roads & Highways",
		listingStage: "unlisted",
		status: "active",
	},
	{
		name: "RAAJMARG INFRA INVESTMENT TRUST",
		sector: "Infrastructure",
		industry: "InvIT - Roads & Highways",
		listingStage: "unlisted",
		status: "active",
	},
	{
		name: "Roadstar Infra Investment Trust",
		sector: "Infrastructure",
		industry: "InvIT - Roads & Highways",
		listingStage: "unlisted",
		status: "active",
	},
	{
		name: "SchoolHouse InvIT",
		sector: "Infrastructure",
		industry: "InvIT - Education Infrastructure",
		listingStage: "unlisted",
		status: "active",
	},
	{
		name: "Shrem InvIT",
		sector: "Infrastructure",
		industry: "InvIT - Roads & Highways",
		listingStage: "unlisted",
		status: "active",
	},
	{
		name: "Tower Infrastructure Trust",
		sector: "Infrastructure",
		industry: "InvIT - Telecom Towers",
		listingStage: "unlisted",
		status: "active",
	},
	{
		name: "Virescent Infrastructure Trust",
		sector: "Infrastructure",
		industry: "InvIT - Renewable Energy",
		listingStage: "unlisted",
		status: "active",
	},
	{
		name: "Digital Fibre Infrastructure Trust",
		sector: "Infrastructure",
		industry: "InvIT - Telecom & Digital",
		listingStage: "unlisted",
		status: "active",
	},
];

export async function seedListedReits(): Promise<number> {
	let count = 0;

	for (const reit of LISTED_REITS) {
		try {
			const existing = await db
				.select()
				.from(reits)
				.where(eq(reits.symbol, reit.symbol));

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
					// SEBI classification per circular Nov 28, 2025
					sebiAssetClass: reit.sebiAssetClass,
					amfiCapCategory: reit.amfiCapCategory,
					equityIndexEligible: reit.equityIndexEligible,
					sebiCircularRef: reit.sebiCircularRef,
					sebiEffectiveDate: reit.sebiEffectiveDate,
				});
				logger.info(`Seeded listed REIT: ${reit.name}`, { event: "seed", entity: "reit", name: reit.name, sebiAssetClass: reit.sebiAssetClass, amfiCapCategory: reit.amfiCapCategory });
				count++;
			} else {
				logger.info(`Listed REIT already exists: ${reit.name}`, { event: "seed_skip", entity: "reit", name: reit.name });
			}
		} catch (error) {
			logger.error(`Failed to seed REIT ${reit.name}`, { event: "seed_error", entity: "reit", name: reit.name, error });
		}
	}

	return count;
}


export async function seedListedInvits(): Promise<number> {
	let count = 0;

	for (const invit of LISTED_INVITS) {
		try {
			const existing = await db
				.select()
				.from(invits)
				.where(eq(invits.symbol, invit.symbol));

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
					// SEBI classification per circular Nov 28, 2025 — InvITs remain hybrid
					sebiAssetClass: invit.sebiAssetClass,
					sebiCircularRef: invit.sebiCircularRef,
					sebiEffectiveDate: invit.sebiEffectiveDate,
				});
				logger.info(`Seeded listed InvIT: ${invit.name}`, { event: "seed", entity: "invit", name: invit.name, sebiAssetClass: invit.sebiAssetClass });
				count++;
			} else {
				logger.info(`Listed InvIT already exists: ${invit.name}`, { event: "seed_skip", entity: "invit", name: invit.name });
			}
		} catch (error) {
			logger.error(`Failed to seed InvIT ${invit.name}`, { event: "seed_error", entity: "invit", name: invit.name, error });
		}
	}

	return count;
}


export async function seedUnlistedReitsInvits(): Promise<number> {
	let count = 0;

	const allUnlisted = [...UNLISTED_REITS, ...UNLISTED_INVITS];

	for (const item of allUnlisted) {
		try {
			const existing = await db
				.select()
				.from(unlistedCompanies)
				.where(eq(unlistedCompanies.name, item.name));

			if (existing.length === 0) {
				await db.insert(unlistedCompanies).values({
					name: item.name,
					sector: item.sector,
					industry: item.industry,
					listingStage: item.listingStage,
					status: item.status,
					pricingStatus: "draft",
				});
				const entityType = item.industry.includes("REIT") ? "REIT" : "InvIT";
				logger.info(`Seeded unlisted ${entityType}: ${item.name}`, { event: "seed", entity: entityType.toLowerCase(), name: item.name });
				count++;
			} else {
				logger.info(`Unlisted already exists: ${item.name}`, { event: "seed_skip", entity: "unlisted", name: item.name });
			}
		} catch (error) {
			logger.error(`Failed to seed unlisted ${item.name}`, { event: "seed_error", entity: "unlisted", name: item.name, error });
		}
	}

	return count;
}


export async function seedAllReitsInvits(): Promise<{
	listedReits: number;
	listedInvits: number;
	unlisted: number;
}> {
	logger.info("Starting REIT/InvIT Seeding", { event: "seed_start", entity: "reit_invit" });

	logger.info("Seeding Listed REITs", { event: "seed_phase", phase: "listed_reits" });
	const listedReits = await seedListedReits();

	logger.info("Seeding Listed InvITs", { event: "seed_phase", phase: "listed_invits" });
	const listedInvits = await seedListedInvits();

	logger.info("Seeding Unlisted REITs & InvITs", { event: "seed_phase", phase: "unlisted" });
	const unlisted = await seedUnlistedReitsInvits();

	logger.info(
		`Seeding summary — REITs: ${listedReits}, InvITs: ${listedInvits}, Unlisted: ${unlisted}`,
		{ event: "seed_summary", listedReits, listedInvits, unlisted, total: listedReits + listedInvits + unlisted },
	);

	return { listedReits, listedInvits, unlisted };
}

const isMainModule =
	process.argv[1] &&
	fileURLToPath(import.meta.url) === process.argv[1] &&
	!process.argv[1]?.endsWith("dist/index.js");

if (isMainModule) {
	seedAllReitsInvits()
		.then((_result) => {
			logger.info("REIT/InvIT seeding completed successfully", { event: "seed_complete", entity: "reit_invit" });
			process.exit(0);
		})
		.catch((error) => {
			logger.error("REIT/InvIT seeding failed", { event: "seed_failed", entity: "reit_invit", error });
			process.exit(1);
		});
}

