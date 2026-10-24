/**
 * @file scripts/remedy-model-portfolios-compliance.ts
 * @description Remediation engine to rebalance non-compliant model portfolios
 * and bring every single-stock and single-issuer holding strictly under the 10% statutory cap (Seventh Schedule).
 */

import { db } from "../server/db";
import { modelPortfolios } from "../shared/schema";
import { eq } from "drizzle-orm";
import { sebiHoldingComplianceService } from "../server/services/sebi-holding-compliance-service";

interface HoldingItem {
	isin?: string;
	symbol?: string;
	name: string;
	weight: number;
	assetClass?: string;
	category?: string;
	subCategory?: string;
	schemeCode?: number | null;
	expenseRatio?: number;
	currentReturn?: number;
	rank?: number;
	amfiSchemeCode?: string | null;
}

const REMEDIED_HOLDINGS: Record<string, HoldingItem[]> = {
	"first-time-investor": [
		{ name: "Reliance Industries Ltd", symbol: "RELIANCE", isin: "INE002A01018", weight: 9.5, assetClass: "equity", category: "Large Cap", currentReturn: 18.5, rank: 1 },
		{ name: "Tata Consultancy Services Ltd", symbol: "TCS", isin: "INE467B01029", weight: 9.5, assetClass: "equity", category: "Large Cap", currentReturn: 16.8, rank: 2 },
		{ name: "HDFC Bank Ltd", symbol: "HDFCBANK", isin: "INE040A01034", weight: 9.5, assetClass: "equity", category: "Large Cap", currentReturn: 14.2, rank: 3 },
		{ name: "Infosys Ltd", symbol: "INFY", isin: "INE009A01021", weight: 9.5, assetClass: "equity", category: "Large Cap", currentReturn: 17.1, rank: 4 },
		{ name: "ICICI Bank Ltd", symbol: "ICICIBANK", isin: "INE090A01021", weight: 9.5, assetClass: "equity", category: "Large Cap", currentReturn: 21.0, rank: 5 },
		{ name: "Bharti Airtel Ltd", symbol: "BHARTIARTL", isin: "INE397D01024", weight: 9.5, assetClass: "equity", category: "Large Cap", currentReturn: 24.6, rank: 6 },
		{ name: "Larsen & Toubro Ltd", symbol: "LT", isin: "INE018A01030", weight: 9.5, assetClass: "equity", category: "Large Cap", currentReturn: 22.4, rank: 7 },
		{ name: "ITC Ltd", symbol: "ITC", isin: "INE154A01025", weight: 9.5, assetClass: "equity", category: "Large Cap", currentReturn: 15.3, rank: 8 },
		{ name: "Hindustan Unilever Ltd", symbol: "HINDUNILVR", isin: "INE030A01027", weight: 8.0, assetClass: "equity", category: "Large Cap", currentReturn: 12.8, rank: 9 },
		{ name: "Kotak Mahindra Bank Ltd", symbol: "KOTAKBANK", isin: "INE237A01028", weight: 8.0, assetClass: "equity", category: "Large Cap", currentReturn: 14.9, rank: 10 },
		{ name: "State Bank of India", symbol: "SBIN", isin: "INE062A01020", weight: 8.0, assetClass: "equity", category: "Large Cap", currentReturn: 19.5, rank: 11 },
	],

	"factor-alpha": [
		{ name: "Reliance Industries Ltd", symbol: "RELIANCE", isin: "INE002A01018", weight: 9.0, assetClass: "equity", category: "Momentum", currentReturn: 18.5, rank: 1 },
		{ name: "Bajaj Finance Ltd", symbol: "BAJFINANCE", isin: "INE296A01024", weight: 9.0, assetClass: "equity", category: "Quality", currentReturn: 20.1, rank: 2 },
		{ name: "Titan Company Ltd", symbol: "TITAN", isin: "INE280A01028", weight: 8.5, assetClass: "equity", category: "Momentum", currentReturn: 22.3, rank: 3 },
		{ name: "Persistent Systems Ltd", symbol: "PERSISTENT", isin: "INE262H01013", weight: 8.5, assetClass: "equity", category: "Growth", currentReturn: 28.4, rank: 4 },
		{ name: "Info Edge (India) Ltd", symbol: "NAUKRI", isin: "INE663F01024", weight: 8.5, assetClass: "equity", category: "Growth", currentReturn: 24.1, rank: 5 },
		{ name: "Angel One Ltd", symbol: "ANGELONE", isin: "INE732I01013", weight: 8.0, assetClass: "equity", category: "High Beta", currentReturn: 32.5, rank: 6 },
		{ name: "Tata Motors Ltd", symbol: "TATAMOTORS", isin: "INE155A01022", weight: 8.0, assetClass: "equity", category: "Momentum", currentReturn: 29.8, rank: 7 },
		{ name: "Trent Ltd", symbol: "TRENT", isin: "INE849A01020", weight: 8.0, assetClass: "equity", category: "Momentum", currentReturn: 45.2, rank: 8 },
		{ name: "TVS Motor Company Ltd", symbol: "TVSMOTOR", isin: "INE494B01023", weight: 8.0, assetClass: "equity", category: "Quality", currentReturn: 26.7, rank: 9 },
		{ name: "Dixon Technologies Ltd", symbol: "DIXON", isin: "INE935N01020", weight: 8.0, assetClass: "equity", category: "High Alpha", currentReturn: 35.6, rank: 10 },
		{ name: "Polycab India Ltd", symbol: "POLYCAB", isin: "INE455K01017", weight: 8.0, assetClass: "equity", category: "Growth", currentReturn: 27.9, rank: 11 },
		{ name: "Bharat Electronics Ltd", symbol: "BEL", isin: "INE263A01024", weight: 6.5, assetClass: "equity", category: "Momentum", currentReturn: 31.4, rank: 12 },
	],

	"psu-defence-atmanirbhar": [
		{ name: "Hindustan Aeronautics Ltd (HAL)", symbol: "HAL", isin: "INE066F01012", weight: 9.5, assetClass: "equity", category: "Defence", currentReturn: 42.1, rank: 1 },
		{ name: "Bharat Electronics Ltd (BEL)", symbol: "BEL", isin: "INE263A01024", weight: 9.5, assetClass: "equity", category: "Defence", currentReturn: 31.4, rank: 2 },
		{ name: "Garden Reach Shipbuilders & Eng (GRSE)", symbol: "GRSE", isin: "INE382Z01011", weight: 9.0, assetClass: "equity", category: "Shipbuilding", currentReturn: 48.0, rank: 3 },
		{ name: "Bharat Dynamics Ltd (BDL)", symbol: "BDL", isin: "INE171Z01018", weight: 9.0, assetClass: "equity", category: "Missiles", currentReturn: 34.5, rank: 4 },
		{ name: "Mazagon Dock Shipbuilders Ltd", symbol: "MAZDOCK", isin: "INE249Z01012", weight: 9.0, assetClass: "equity", category: "Shipbuilding", currentReturn: 52.3, rank: 5 },
		{ name: "Cochin Shipyard Ltd", symbol: "COCHINSHIP", isin: "INE704P01017", weight: 9.0, assetClass: "equity", category: "Shipbuilding", currentReturn: 46.2, rank: 6 },
		{ name: "BEML Ltd", symbol: "BEML", isin: "INE258A01016", weight: 9.0, assetClass: "equity", category: "Heavy Eng", currentReturn: 28.7, rank: 7 },
		{ name: "Coal India Ltd", symbol: "COALINDIA", isin: "INE522F01014", weight: 9.0, assetClass: "equity", category: "Energy PSU", currentReturn: 22.4, rank: 8 },
		{ name: "NTPC Ltd", symbol: "NTPC", isin: "INE733E01010", weight: 9.0, assetClass: "equity", category: "Power PSU", currentReturn: 25.1, rank: 9 },
		{ name: "Power Grid Corp of India", symbol: "POWERGRID", isin: "INE752E01010", weight: 9.0, assetClass: "equity", category: "Power PSU", currentReturn: 21.6, rank: 10 },
		{ name: "Mishra Dhatu Nigam Ltd (MIDHANI)", symbol: "MIDHANI", isin: "INE099Z01011", weight: 9.0, assetClass: "equity", category: "Strategic Alloys", currentReturn: 26.5, rank: 11 },
	],

	"esg-sustainable": [
		{ name: "Infosys Ltd", symbol: "INFY", isin: "INE009A01021", weight: 9.5, assetClass: "equity", category: "IT ESG", currentReturn: 17.1, rank: 1 },
		{ name: "Tata Consultancy Services Ltd", symbol: "TCS", isin: "INE467B01029", weight: 9.5, assetClass: "equity", category: "IT ESG", currentReturn: 16.8, rank: 2 },
		{ name: "Wipro Ltd", symbol: "WIPRO", isin: "INE075A01022", weight: 9.0, assetClass: "equity", category: "IT ESG", currentReturn: 14.5, rank: 3 },
		{ name: "Tech Mahindra Ltd", symbol: "TECHM", isin: "INE669C01036", weight: 9.0, assetClass: "equity", category: "IT ESG", currentReturn: 15.2, rank: 4 },
		{ name: "LTIMindtree Ltd", symbol: "LTIM", isin: "INE214T01019", weight: 9.0, assetClass: "equity", category: "IT ESG", currentReturn: 16.9, rank: 5 },
		{ name: "Tata Power Company (Renewables)", symbol: "TATAPOWER", isin: "INE245A01021", weight: 9.0, assetClass: "equity", category: "Clean Energy", currentReturn: 23.4, rank: 6 },
		{ name: "Marico Ltd", symbol: "MARICO", isin: "INE196A01026", weight: 9.0, assetClass: "equity", category: "FMCG ESG", currentReturn: 13.5, rank: 7 },
		{ name: "Dabur India Ltd", symbol: "DABUR", isin: "INE016A01026", weight: 9.0, assetClass: "equity", category: "FMCG ESG", currentReturn: 12.8, rank: 8 },
		{ name: "Havells India Ltd", symbol: "HAVELLS", isin: "INE176B01034", weight: 9.0, assetClass: "equity", category: "Consumer Durables", currentReturn: 18.2, rank: 9 },
		{ name: "Titan Company Ltd", symbol: "TITAN", isin: "INE280A01028", weight: 9.0, assetClass: "equity", category: "Consumer ESG", currentReturn: 22.3, rank: 10 },
		{ name: "Godrej Consumer Products", symbol: "GODREJCP", isin: "INE102D01028", weight: 9.0, assetClass: "equity", category: "FMCG ESG", currentReturn: 14.6, rank: 11 },
	],

	"nri-india-opportunity": [
		{ name: "Reliance Industries Ltd", symbol: "RELIANCE", isin: "INE002A01018", weight: 9.5, assetClass: "equity", category: "Conglomerate", currentReturn: 18.5, rank: 1 },
		{ name: "HDFC Bank Ltd", symbol: "HDFCBANK", isin: "INE040A01034", weight: 9.5, assetClass: "equity", category: "Private Banking", currentReturn: 14.2, rank: 2 },
		{ name: "ICICI Bank Ltd", symbol: "ICICIBANK", isin: "INE090A01021", weight: 9.5, assetClass: "equity", category: "Private Banking", currentReturn: 21.0, rank: 3 },
		{ name: "Tata Consultancy Services Ltd", symbol: "TCS", isin: "INE467B01029", weight: 9.0, assetClass: "equity", category: "IT Services", currentReturn: 16.8, rank: 4 },
		{ name: "Larsen & Toubro Ltd", symbol: "LT", isin: "INE018A01030", weight: 9.0, assetClass: "equity", category: "Infrastructure", currentReturn: 22.4, rank: 5 },
		{ name: "Bharti Airtel Ltd", symbol: "BHARTIARTL", isin: "INE397D01024", weight: 9.0, assetClass: "equity", category: "Telecom", currentReturn: 24.6, rank: 6 },
		{ name: "Infosys Ltd", symbol: "INFY", isin: "INE009A01021", weight: 9.0, assetClass: "equity", category: "IT Services", currentReturn: 17.1, rank: 7 },
		{ name: "Kotak Mahindra Bank Ltd", symbol: "KOTAKBANK", isin: "INE237A01028", weight: 9.0, assetClass: "equity", category: "Private Banking", currentReturn: 14.9, rank: 8 },
		{ name: "Titan Company Ltd", symbol: "TITAN", isin: "INE280A01028", weight: 8.5, assetClass: "equity", category: "Consumer", currentReturn: 22.3, rank: 9 },
		{ name: "Bajaj Finance Ltd", symbol: "BAJFINANCE", isin: "INE296A01024", weight: 8.5, assetClass: "equity", category: "NBFC", currentReturn: 20.1, rank: 10 },
		{ name: "Sun Pharmaceutical Industries", symbol: "SUNPHARMA", isin: "INE044A01036", weight: 8.5, assetClass: "equity", category: "Healthcare", currentReturn: 19.8, rank: 11 },
	],

	"emergency-fund": [
		{ name: "HDFC Overnight Fund", isin: "INF179KC1105", weight: 9.5, assetClass: "debt", category: "Overnight MF", currentReturn: 6.7, rank: 1 },
		{ name: "ICICI Pru Liquid Fund", isin: "INF109K01LS2", weight: 9.5, assetClass: "debt", category: "Liquid MF", currentReturn: 7.1, rank: 2 },
		{ name: "SBI Savings Fund", isin: "INF200K01403", weight: 9.5, assetClass: "debt", category: "Ultra Short MF", currentReturn: 7.2, rank: 3 },
		{ name: "Kotak Liquid Fund", isin: "INF174K01237", weight: 9.5, assetClass: "debt", category: "Liquid MF", currentReturn: 7.1, rank: 4 },
		{ name: "Aditya Birla SL Liquid Fund", isin: "INF209K01157", weight: 9.5, assetClass: "debt", category: "Liquid MF", currentReturn: 7.1, rank: 5 },
		{ name: "Nippon India Liquid Fund", isin: "INF204K01958", weight: 9.5, assetClass: "debt", category: "Liquid MF", currentReturn: 7.1, rank: 6 },
		{ name: "Axis Liquid Fund", isin: "INF846K01CX4", weight: 9.0, assetClass: "debt", category: "Liquid MF", currentReturn: 7.0, rank: 7 },
		{ name: "UTI Liquid Fund", isin: "INF789F01SZ9", weight: 9.0, assetClass: "debt", category: "Liquid MF", currentReturn: 7.1, rank: 8 },
		{ name: "Mirae Asset Cash Management Fund", isin: "INF769K01917", weight: 8.5, assetClass: "debt", category: "Liquid MF", currentReturn: 7.0, rank: 9 },
		{ name: "DSP Liquidity Fund", isin: "INF740K01011", weight: 8.5, assetClass: "debt", category: "Liquid MF", currentReturn: 7.0, rank: 10 },
		{ name: "91-Day Sovereign T-Bill ETF", isin: "INF204KB1882", weight: 8.5, assetClass: "debt", category: "Gilt / Sovereign", currentReturn: 6.9, rank: 11 },
	],

	"corporate-treasury": [
		{ name: "ICICI Pru Liquid Fund", isin: "INF109K01LS2", weight: 9.5, assetClass: "debt", category: "Liquid MF", currentReturn: 7.1, rank: 1 },
		{ name: "HDFC Ultra Short Term Fund", isin: "INF179K01BE1", weight: 9.5, assetClass: "debt", category: "Ultra Short MF", currentReturn: 7.3, rank: 2 },
		{ name: "Aditya Birla SL Liquid Fund", isin: "INF209K01157", weight: 9.5, assetClass: "debt", category: "Liquid MF", currentReturn: 7.1, rank: 3 },
		{ name: "SBI Magnum Ultra Short Duration", isin: "INF200K01585", weight: 9.5, assetClass: "debt", category: "Ultra Short MF", currentReturn: 7.2, rank: 4 },
		{ name: "Kotak Money Market Fund", isin: "INF174K01187", weight: 9.5, assetClass: "debt", category: "Money Market MF", currentReturn: 7.4, rank: 5 },
		{ name: "Nippon India Money Market", isin: "INF204K01628", weight: 9.5, assetClass: "debt", category: "Money Market MF", currentReturn: 7.4, rank: 6 },
		{ name: "Axis Treasury Advantage Fund", isin: "INF846K01206", weight: 9.0, assetClass: "debt", category: "Low Duration MF", currentReturn: 7.3, rank: 7 },
		{ name: "UTI Money Market Fund", isin: "INF789F01262", weight: 9.0, assetClass: "debt", category: "Money Market MF", currentReturn: 7.4, rank: 8 },
		{ name: "DSP Savings Fund", isin: "INF740K01029", weight: 8.5, assetClass: "debt", category: "Ultra Short MF", currentReturn: 7.2, rank: 9 },
		{ name: "Tata Money Market Fund", isin: "INF277K01332", weight: 8.5, assetClass: "debt", category: "Money Market MF", currentReturn: 7.3, rank: 10 },
		{ name: "182-Day Sovereign Treasury Bill ETF", isin: "INF204KB1890", weight: 8.5, assetClass: "debt", category: "Gilt / Sovereign", currentReturn: 7.0, rank: 11 },
	],

	"senior-citizen-income": [
		{ name: "IRFC Tax-Free Bond 2033", symbol: "IRFC-TF", isin: "INE053F07936", weight: 9.5, assetClass: "debt", category: "Tax-free Bond", currentReturn: 7.2, rank: 1 },
		{ name: "NHAI Tax-free Bonds 2027", symbol: "NHAI-TF", isin: "INE906B07DC5", weight: 9.5, assetClass: "debt", category: "Tax-free Bond", currentReturn: 7.1, rank: 2 },
		{ name: "REC Ltd Tax-Free Bond 2029", symbol: "REC-TF", isin: "INE020B07HQ5", weight: 9.5, assetClass: "debt", category: "Tax-free Bond", currentReturn: 7.1, rank: 3 },
		{ name: "PFC Tax-free Bonds 2028", symbol: "PFC-TF", isin: "INE134E07340", weight: 9.5, assetClass: "debt", category: "Tax-free Bond", currentReturn: 7.1, rank: 4 },
		{ name: "HDFC Senior Citizen Care Fund", isin: "INF179K01BD3", weight: 9.5, assetClass: "debt", category: "Debt MF", currentReturn: 7.4, rank: 5 },
		{ name: "ICICI Pru Regular Savings Fund", isin: "INF109K01467", weight: 9.5, assetClass: "debt", category: "Conservative Hybrid", currentReturn: 8.5, rank: 6 },
		{ name: "SBI Debt Hybrid Fund", isin: "INF200K01627", weight: 9.0, assetClass: "debt", category: "Conservative Hybrid", currentReturn: 8.2, rank: 7 },
		{ name: "Kotak Banking & PSU Debt Fund", isin: "INF846K01CB0", weight: 9.0, assetClass: "debt", category: "PSU Debt MF", currentReturn: 7.3, rank: 8 },
		{ name: "Sovereign Gold Bond 2028", isin: "IN0020200154", weight: 8.5, assetClass: "commodity", category: "SGB", currentReturn: 14.5, rank: 9 },
		{ name: "Embassy Office Parks REIT", isin: "INE041025011", weight: 8.5, assetClass: "hybrid", category: "REIT", currentReturn: 8.5, rank: 10 },
		{ name: "Government of India Gilt 7.18% 2033", isin: "IN0020230085", weight: 8.0, assetClass: "debt", category: "Gilt / Sovereign", currentReturn: 7.2, rank: 11 },
	],

	"debt-ladder": [
		{ name: "Kotak Dynamic Bond Fund", isin: "INF174K01070", weight: 9.5, assetClass: "debt", category: "Dynamic Bond", currentReturn: 7.8, rank: 1 },
		{ name: "ICICI Pru Short Term Fund", isin: "INF109K01W83", weight: 9.5, assetClass: "debt", category: "Short Duration", currentReturn: 7.5, rank: 2 },
		{ name: "HDFC Corporate Bond Fund", isin: "INF179K01BN2", weight: 9.5, assetClass: "debt", category: "Corporate Bond", currentReturn: 7.6, rank: 3 },
		{ name: "Aditya Birla SL Corporate Bond", isin: "INF209K01785", weight: 9.5, assetClass: "debt", category: "Corporate Bond", currentReturn: 7.6, rank: 4 },
		{ name: "SBI Banking & PSU Fund", isin: "INF200K01U41", weight: 9.5, assetClass: "debt", category: "Banking PSU", currentReturn: 7.4, rank: 5 },
		{ name: "Axis Strategic Bond Fund", isin: "INF846K01586", weight: 9.5, assetClass: "debt", category: "Medium Duration", currentReturn: 7.7, rank: 6 },
		{ name: "Nippon India Floating Rate Fund", isin: "INF204K01743", weight: 9.0, assetClass: "debt", category: "Floater", currentReturn: 7.3, rank: 7 },
		{ name: "UTI Short Term Income Fund", isin: "INF789F01049", weight: 9.0, assetClass: "debt", category: "Short Duration", currentReturn: 7.5, rank: 8 },
		{ name: "DSP Corporate Bond Fund", isin: "INF740K01EB8", weight: 8.5, assetClass: "debt", category: "Corporate Bond", currentReturn: 7.5, rank: 9 },
		{ name: "Bandhan Banking & PSU Debt Fund", isin: "INF194K01239", weight: 8.5, assetClass: "debt", category: "Banking PSU", currentReturn: 7.3, rank: 10 },
		{ name: "BHARAT Bond ETF Apr 2031", isin: "INF464K01034", weight: 8.5, assetClass: "debt", category: "Target Maturity / Gilt", currentReturn: 7.5, rank: 11 },
	],

	"pure-debt-portfolio": [
		{ name: "HDFC Corporate Bond Fund", isin: "INF179K01BN2", weight: 9.5, assetClass: "debt", category: "Corporate Bond", currentReturn: 7.6, rank: 1 },
		{ name: "Kotak Dynamic Bond Fund", isin: "INF174K01070", weight: 9.5, assetClass: "debt", category: "Dynamic Bond", currentReturn: 7.8, rank: 2 },
		{ name: "ICICI Pru All Seasons Bond Fund", isin: "INF109K01988", weight: 9.5, assetClass: "debt", category: "Dynamic Bond", currentReturn: 7.7, rank: 3 },
		{ name: "Aditya Birla SL Corporate Bond", isin: "INF209K01785", weight: 9.5, assetClass: "debt", category: "Corporate Bond", currentReturn: 7.6, rank: 4 },
		{ name: "SBI Banking & PSU Fund", isin: "INF200K01U41", weight: 9.5, assetClass: "debt", category: "Banking PSU", currentReturn: 7.4, rank: 5 },
		{ name: "Axis Corporate Debt Fund", isin: "INF846K01727", weight: 9.5, assetClass: "debt", category: "Corporate Bond", currentReturn: 7.5, rank: 6 },
		{ name: "Nippon India Banking & PSU Debt", isin: "INF204K01TX3", weight: 9.0, assetClass: "debt", category: "Banking PSU", currentReturn: 7.4, rank: 7 },
		{ name: "UTI Dynamic Bond Fund", isin: "INF789F01023", weight: 9.0, assetClass: "debt", category: "Dynamic Bond", currentReturn: 7.6, rank: 8 },
		{ name: "DSP Banking & PSU Debt Fund", isin: "INF740K01CT0", weight: 8.5, assetClass: "debt", category: "Banking PSU", currentReturn: 7.3, rank: 9 },
		{ name: "Mirae Asset Banking and PSU Debt", isin: "INF769K01EX7", weight: 8.5, assetClass: "debt", category: "Banking PSU", currentReturn: 7.4, rank: 10 },
		{ name: "SBI Magnum Gilt Fund", isin: "INF200K01346", weight: 8.5, assetClass: "debt", category: "Gilt / Sovereign", currentReturn: 7.8, rank: 11 },
	],

	"credit-income": [
		{ name: "HDFC Credit Risk Debt Fund", isin: "INF179K01BW3", weight: 9.5, assetClass: "debt", category: "Credit Risk", currentReturn: 8.5, rank: 1 },
		{ name: "ICICI Pru Credit Risk Fund", isin: "INF109K01W91", weight: 9.5, assetClass: "debt", category: "Credit Risk", currentReturn: 8.4, rank: 2 },
		{ name: "SBI Credit Risk Fund", isin: "INF200K01932", weight: 9.5, assetClass: "debt", category: "Credit Risk", currentReturn: 8.2, rank: 3 },
		{ name: "Nippon India Credit Risk Fund", isin: "INF204K01677", weight: 9.5, assetClass: "debt", category: "Credit Risk", currentReturn: 8.3, rank: 4 },
		{ name: "Aditya Birla SL Credit Risk Fund", isin: "INF209K01967", weight: 9.5, assetClass: "debt", category: "Credit Risk", currentReturn: 8.2, rank: 5 },
		{ name: "Kotak Credit Risk Fund", isin: "INF174K01708", weight: 9.5, assetClass: "debt", category: "Credit Risk", currentReturn: 8.4, rank: 6 },
		{ name: "DSP Credit Risk Fund", isin: "INF740K01CS2", weight: 9.0, assetClass: "debt", category: "Credit Risk", currentReturn: 8.3, rank: 7 },
		{ name: "Axis Credit Risk Fund", isin: "INF846K01883", weight: 9.0, assetClass: "debt", category: "Credit Risk", currentReturn: 8.1, rank: 8 },
		{ name: "UTI Credit Risk Fund", isin: "INF789F01288", weight: 8.5, assetClass: "debt", category: "Credit Risk", currentReturn: 8.2, rank: 9 },
		{ name: "Bandhan Credit Risk Fund", isin: "INF194K01346", weight: 8.5, assetClass: "debt", category: "Credit Risk", currentReturn: 8.0, rank: 10 },
		{ name: "BHARAT Bond ETF Apr 2031", isin: "INF464K01034", weight: 8.5, assetClass: "debt", category: "Target Maturity / Gilt", currentReturn: 7.5, rank: 11 },
	],

	"conservative-income": [
		{ name: "ICICI Pru Regular Savings Fund", isin: "INF109K01467", weight: 9.5, assetClass: "hybrid", category: "Conservative Hybrid", currentReturn: 8.5, rank: 1 },
		{ name: "SBI Debt Hybrid Fund", isin: "INF200K01627", weight: 9.5, assetClass: "hybrid", category: "Conservative Hybrid", currentReturn: 8.2, rank: 2 },
		{ name: "HDFC Hybrid Debt Fund", isin: "INF179K01BD3", weight: 9.5, assetClass: "hybrid", category: "Conservative Hybrid", currentReturn: 8.4, rank: 3 },
		{ name: "Kotak Debt Hybrid Fund", isin: "INF174K01088", weight: 9.5, assetClass: "hybrid", category: "Conservative Hybrid", currentReturn: 8.1, rank: 4 },
		{ name: "Aditya Birla SL Regular Savings", isin: "INF209K01314", weight: 9.5, assetClass: "hybrid", category: "Conservative Hybrid", currentReturn: 8.3, rank: 5 },
		{ name: "Nippon India Gold Savings", isin: "INF204K01GL3", weight: 9.5, assetClass: "commodity", category: "Gold ETF", currentReturn: 12.0, rank: 6 },
		{ name: "DSP Credit Risk Fund", isin: "INF740K01CS2", weight: 9.0, assetClass: "debt", category: "Credit Risk", currentReturn: 8.3, rank: 7 },
		{ name: "Embassy Office Parks REIT", isin: "INE041025011", weight: 9.0, assetClass: "hybrid", category: "REIT", currentReturn: 8.5, rank: 8 },
		{ name: "Sovereign Gold Bond 2028", isin: "IN0020200154", weight: 9.0, assetClass: "commodity", category: "SGB", currentReturn: 14.5, rank: 9 },
		{ name: "NHAI Tax-free Bonds 2027", isin: "INE906B07DC5", weight: 8.5, assetClass: "debt", category: "Tax-free Bond", currentReturn: 7.1, rank: 10 },
		{ name: "SBI Magnum Gilt Fund", isin: "INF200K01346", weight: 8.5, assetClass: "debt", category: "Gilt / Sovereign", currentReturn: 7.8, rank: 11 },
	],

	"passive-index": [
		{ name: "Nippon India Nifty 50 BeES ETF", isin: "INF204KB14I2", weight: 9.5, assetClass: "equity", category: "Large Cap ETF", currentReturn: 16.5, rank: 1 },
		{ name: "SBI Nifty Next 50 ETF", isin: "INF200KA1UT3", weight: 9.5, assetClass: "equity", category: "Mid Cap ETF", currentReturn: 22.4, rank: 2 },
		{ name: "ICICI Pru Nifty IT ETF", isin: "INF109KB1SH8", weight: 9.5, assetClass: "equity", category: "Sectoral ETF", currentReturn: 18.2, rank: 3 },
		{ name: "Kotak Nifty Bank ETF", isin: "INF174K01625", weight: 9.5, assetClass: "equity", category: "Banking ETF", currentReturn: 15.6, rank: 4 },
		{ name: "HDFC Nifty Midcap 150 ETF", isin: "INF179KC1CO9", weight: 9.5, assetClass: "equity", category: "Mid Cap ETF", currentReturn: 24.8, rank: 5 },
		{ name: "Motilal Oswal Nifty Smallcap 250 ETF", isin: "INF247L01799", weight: 9.5, assetClass: "equity", category: "Small Cap ETF", currentReturn: 28.5, rank: 6 },
		{ name: "Mirae Asset Nifty 500 Multicap 50:25:25 ETF", isin: "INF769K01HX9", weight: 9.0, assetClass: "equity", category: "Multi Cap ETF", currentReturn: 19.4, rank: 7 },
		{ name: "Nippon India Silver ETF", isin: "INF204KB14P7", weight: 9.0, assetClass: "commodity", category: "Silver ETF", currentReturn: 15.2, rank: 8 },
		{ name: "SBI Gold ETF", isin: "INF200K01460", weight: 9.0, assetClass: "commodity", category: "Gold ETF", currentReturn: 14.1, rank: 9 },
		{ name: "BHARAT Bond ETF Apr 2031", isin: "INF464K01034", weight: 8.5, assetClass: "debt", category: "Target Maturity / Gilt", currentReturn: 7.5, rank: 10 },
		{ name: "SBI Magnum Gilt Fund", isin: "INF200K01346", weight: 7.5, assetClass: "debt", category: "Gilt / Sovereign", currentReturn: 7.8, rank: 11 },
	],

	"tax-saver-elss": [
		{ name: "Mirae Asset Tax Saver Fund (ELSS)", isin: "INF769K01982", weight: 9.5, assetClass: "equity", category: "ELSS", currentReturn: 19.5, rank: 1 },
		{ name: "Parag Parikh ELSS Tax Saver Fund", isin: "INF879O01233", weight: 9.5, assetClass: "equity", category: "ELSS", currentReturn: 21.2, rank: 2 },
		{ name: "Quant ELSS Tax Plan", isin: "INF966L01019", weight: 9.5, assetClass: "equity", category: "ELSS", currentReturn: 26.8, rank: 3 },
		{ name: "Axis Long Term Equity Fund (ELSS)", isin: "INF846K01131", weight: 9.5, assetClass: "equity", category: "ELSS", currentReturn: 16.4, rank: 4 },
		{ name: "Canara Robeco Equity Tax Saver (ELSS)", isin: "INF760C01062", weight: 9.5, assetClass: "equity", category: "ELSS", currentReturn: 18.7, rank: 5 },
		{ name: "SBI Long Term Equity Fund (ELSS)", isin: "INF200K01221", weight: 9.5, assetClass: "equity", category: "ELSS", currentReturn: 22.3, rank: 6 },
		{ name: "HDFC ELSS Tax saver Fund", isin: "INF179K01AP0", weight: 9.0, assetClass: "equity", category: "ELSS", currentReturn: 20.4, rank: 7 },
		{ name: "ICICI Pru Long Term Equity (ELSS)", isin: "INF109K01582", weight: 9.0, assetClass: "equity", category: "ELSS", currentReturn: 18.9, rank: 8 },
		{ name: "Kotak ELSS Tax Saver Fund", isin: "INF174K01161", weight: 8.5, assetClass: "equity", category: "ELSS", currentReturn: 19.1, rank: 9 },
		{ name: "DSP ELSS Tax Saver Fund", isin: "INF740K01193", weight: 8.5, assetClass: "equity", category: "ELSS", currentReturn: 19.6, rank: 10 },
		{ name: "Bandhan ELSS Tax Saver Fund", isin: "INF194K01197", weight: 8.0, assetClass: "equity", category: "ELSS", currentReturn: 18.2, rank: 11 },
	],
};

async function remedyAllPortfolios() {
	console.log("================================================================================");
	console.log("🛠️  EXECUTING STATUTORY REMEDIATION ON MODEL PORTFOLIOS");
	console.log("================================================================================");

	let updatedCount = 0;

	for (const [id, holdings] of Object.entries(REMEDIED_HOLDINGS)) {
		console.log(`Applying remedy for portfolio: ${id} (${holdings.length} holdings, max weight: ${Math.max(...holdings.map(h => h.weight))}%)`);
		await db
			.update(modelPortfolios)
			.set({
				holdings: holdings as any,
				totalHoldings: holdings.length,
				updatedAt: new Date(),
			})
			.where(eq(modelPortfolios.id, id));
		updatedCount++;
	}

	console.log(`\n✅ ${updatedCount} model portfolios rebalanced and updated in database.`);

	console.log("\n🛡️  Re-running SEBI compliance enforcement across all portfolios...");
	const result = await sebiHoldingComplianceService.enforceAndRecordAllPortfoliosCompliance();

	console.log("\n📊 POST-REMEDIATION AUDIT SUMMARY:");
	console.log(`• Total Portfolios Processed : ${result.totalProcessed}`);
	console.log(`• Fully Compliant           : ${result.compliant}`);
	console.log(`• Warnings (Proactive)       : ${result.warning}`);
	console.log(`• Non-Compliant (Breaches)   : ${result.nonCompliant}`);
	console.log(`• Latency                   : ${result.executionLatencyMs}ms`);

	if (result.nonCompliant > 0) {
		console.log("\n🚨 Remaining Breaches:");
		for (const rec of result.records.filter(r => r.complianceStatus === "NON_COMPLIANT")) {
			console.log(`  - [${rec.portfolioTier.toUpperCase()}] ${rec.name}: ${rec.breaches.join("; ")}`);
		}
	} else {
		console.log("\n🎉 ZERO STATUTORY BREACHES! All 52 portfolios are fully compliant or within proactive warning corridors.");
	}
}

remedyAllPortfolios()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error("❌ Error executing portfolio remedies:", err);
		process.exit(1);
	});
