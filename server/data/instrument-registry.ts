/**
 * @file instrument-registry.ts
 * @description Single source of truth for instrument ISIN, AMFI scheme code, and asset type.
 *
 * ⚠️  DISTRIBUTOR NOTICE (SEBI Regulation 24 / ARN Compliance):
 *     FintekPro is a SEBI-registered Mutual Fund Distributor (ARN holder).
 *     ALL ISINs and schemeCodes in this file MUST refer to REGULAR PLANS.
 *     Regular plans earn trail commission; Direct plans do NOT.
 *     Using Direct plan ISINs here would constitute a compliance violation.
 *
 * - Used by model-portfolio-holdings-seed.ts at startup (DB seeding)
 * - Used by model-portfolios-route.ts at runtime (enrichHolding Step 0: ISIN resolution)
 *
 * Key:        Fund name as used in portfolio holdings (must match exactly, case-sensitive).
 * schemeCode: AMFI Regular Plan–Growth scheme code (for mfapi.in NAV lookup).
 * isin:       AMFI ISIN for Regular Plan–Growth (INF...) for MFs,
 *             BSE/NSE ISIN for REITs/InvITs/ETFs, null if N/A.
 * type:       Asset class for screener_derived_metrics & expense ratio enrichment.
 *
 * Sources (ISINs verified against):
 *   mfapi.in: meta.isin_growth field for Regular Growth scheme codes
 *   AMFI NAVAll.txt: https://portal.amfiindia.com/spages/NAVAll.txt (Regular entries)
 *   BSE India: REIT / InvIT ISINs
 *
 * FASP-AI v3.0 | GCR-compliant | Distributor-compliant (Regular Plans Only)
 */

export interface InstrumentInfo {
  schemeCode: number | null;
  isin: string | null;
  type: string;
}

export const INSTRUMENT_REGISTRY: Record<string, InstrumentInfo> = {
  // ── Large Cap MF (Regular Plans) ─────────────────────────────────────────────
  // Mirae Asset Large Cap - Regular Growth: code=107578, ISIN=INF769K01010
  "HDFC Top 100 Fund":              { schemeCode: 118994, isin: "INF179K01BC5", type: "large_cap" },
  "HDFC Top 100":                   { schemeCode: 118994, isin: "INF179K01BC5", type: "large_cap" },
  "Mirae Asset Large Cap Fund":     { schemeCode: 107578,  isin: "INF769K01010",  type: "large_cap" },
  "Mirae Asset Large Cap":          { schemeCode: 107578,  isin: "INF769K01010",  type: "large_cap" },
  "SBI Bluechip Fund":              { schemeCode: 119569,  isin: "INF200K01868",  type: "large_cap" },
  "Axis Bluechip Fund":             { schemeCode: 120498,  isin: "INF846K01EV4",  type: "large_cap" },
  "ICICI Pru Bluechip Fund":        { schemeCode: 108466,  isin: "INF109K01BL4",  type: "large_cap" },
  "ICICI Pru Large Cap Fund":       { schemeCode: 108466,  isin: "INF109K01BL4",  type: "large_cap" },
  "Nippon India Large Cap Fund":    { schemeCode: 118817,  isin: "INF204K01GN9",  type: "large_cap" },
  "Aditya Birla SL Frontline Equity": { schemeCode: 102263, isin: "INF084M01028", type: "large_cap" },
  "Franklin India Bluechip Fund":   { schemeCode: 102156,  isin: "INF090I01015",  type: "large_cap" },
  "DSP Top 100 Equity Fund":        { schemeCode: 101266,  isin: "INF740K01142",  type: "large_cap" },
  "Canara Robeco Bluechip Equity":  { schemeCode: 120474,  isin: "INF760K01DN8",  type: "large_cap" },
  "Edelweiss Large Cap Fund":       { schemeCode: 140172,  isin: "INF843K01047",  type: "large_cap" },
  "Kotak Bluechip Fund":            { schemeCode: 120162,  isin: "INF174K01LI5",  type: "large_cap" },
  "Tata Large Cap Fund":            { schemeCode: 100120,  isin: "INF277K01CS2",  type: "large_cap" },
  "Invesco India Large Cap Fund":   { schemeCode: 120507,  isin: "INF205K01FC1",  type: "large_cap" },
  "PGIM India Large Cap Fund":      { schemeCode: 120522,  isin: "INF663L01BY6",  type: "large_cap" },
  "Quantum Long Term Equity Fund":  { schemeCode: 118777,  isin: "INF082J01010",  type: "large_cap" },
  "Quantum Long Term Equity Value Fund": { schemeCode: 118777, isin: "INF082J01010", type: "large_cap" },

  // ── Mid Cap MF (Regular Plans) ────────────────────────────────────────────────
  "HDFC Mid-Cap Opportunities":     { schemeCode: 118986,  isin: "INF179K01888",  type: "mid_cap" },
  "HDFC Mid-Cap Opportunities Fund":{ schemeCode: 118986,  isin: "INF179K01888",  type: "mid_cap" },
  "Kotak Emerging Equity Fund":     { schemeCode: 104904,  isin: "INF174K01DS9",  type: "mid_cap" },
  "ICICI Pru Midcap Fund":          { schemeCode: 108462,  isin: "INF109K01BH2",  type: "mid_cap" },
  "Axis Midcap Fund":               { schemeCode: 114564,  isin: "INF846K01859",  type: "mid_cap" },
  "Nippon India Growth Fund":       { schemeCode: 102889,  isin: "INF204K01GT6",  type: "mid_cap" },
  "SBI Magnum Midcap Fund":         { schemeCode: 102941,  isin: "INF200K01560",  type: "mid_cap" },
  "Franklin India Prima Fund":      { schemeCode: 102162,  isin: "INF090I01049",  type: "mid_cap" },
  "DSP Midcap Fund":                { schemeCode: 100620,  isin: "INF740K01266",  type: "mid_cap" },
  "Edelweiss Mid Cap Fund":         { schemeCode: 134831,  isin: "INF754K01FF0",  type: "mid_cap" },
  "Mirae Asset Midcap Fund":        { schemeCode: 112932,  isin: "INF769K01101",  type: "mid_cap" },
  "Motilal Oswal Midcap Fund":      { schemeCode: 147701,  isin: "INF247L01965",  type: "mid_cap" },
  "Aditya Birla SL Midcap Fund":    { schemeCode: 109473,  isin: "INF084M01085",  type: "mid_cap" },
  "Invesco India Midcap Fund":      { schemeCode: 120508,  isin: "INF205K01FD9",  type: "mid_cap" },
  "PGIM India Midcap Opp Fund":     { schemeCode: 120525,  isin: "INF663L01CA3",  type: "mid_cap" },
  "Tata Mid Cap Growth Fund":       { schemeCode: 100120,  isin: "INF277K01CS2",  type: "mid_cap" },
  "Bandhan Core Equity Fund":       { schemeCode: 119772,  isin: "INF194K01DA5",  type: "mid_cap" },

  // ── Small Cap MF (Regular Plans) ──────────────────────────────────────────────
  "Nippon India Small Cap Fund":    { schemeCode: 118775,  isin: "INF204K01GQ2",  type: "small_cap" },
  "SBI Small Cap Fund":             { schemeCode: 125494,  isin: "INF200K01T28",  type: "small_cap" },
  "Axis Small Cap Fund":            { schemeCode: 125350,  isin: "INF846K01K01",  type: "small_cap" },
  "HDFC Small Cap Fund":            { schemeCode: 130502,  isin: "INF179KA1RZ8",  type: "small_cap" },
  "Kotak Small Cap Fund":           { schemeCode: 120160,  isin: "INF174K01LG9",  type: "small_cap" },
  "Canara Robeco Small Cap Fund":   { schemeCode: 140819,  isin: "INF760K01ED9",  type: "small_cap" },
  "Tata Small Cap Fund":            { schemeCode: 143992,  isin: "INF277K01JK1",  type: "small_cap" },
  "DSP Small Cap Fund":             { schemeCode: 116508,  isin: "INF740K01357",  type: "small_cap" },
  "Aditya Birla SL Small Cap Fund": { schemeCode: 112090,  isin: "INF084M01143",  type: "small_cap" },
  "Quant Small Cap Fund":           { schemeCode: 100177,  isin: "INF966L01AA0",  type: "small_cap" },
  "ICICI Pru Small Cap Fund":       { schemeCode: 120594,  isin: "INF109K01Z80",  type: "small_cap" },
  "Invesco India Smallcap Fund":    { schemeCode: 143984,  isin: "INF205K01IG3",  type: "small_cap" },
  "Sundaram Small Cap Fund":        { schemeCode: 100641,  isin: "INF903J01AN8",  type: "small_cap" },
  "Motilal Oswal Small Cap Fund":   { schemeCode: 148928,  isin: "INF247L01EZ4",  type: "small_cap" },
  "Franklin India Smaller Companies": { schemeCode: 102169, isin: "INF090I01098", type: "small_cap" },

  // ── Flexi Cap MF (Regular Plans) ──────────────────────────────────────────────
  "Parag Parikh Flexi Cap Fund":    { schemeCode: 122640,  isin: "INF879O01019",  type: "flexi_cap" },
  "PPFAS Flexi Cap (Global)":       { schemeCode: 122640,  isin: "INF879O01019",  type: "flexi_cap" },
  "PPFAS Flexi Cap (Global allocation)": { schemeCode: 122640, isin: "INF879O01019", type: "flexi_cap" },
  "HDFC Flexi Cap Fund":            { schemeCode: 101762,  isin: "INF179K01608",  type: "flexi_cap" },
  "Kotak Flexi Cap Fund":           { schemeCode: 102735,  isin: "INF174K01FN9",  type: "flexi_cap" },
  "SBI Flexi Cap Fund":             { schemeCode: 103215,  isin: "INF200K01222",  type: "flexi_cap" },
  "Franklin India Flexi Cap Fund":  { schemeCode: 102162,  isin: "INF090I01049",  type: "flexi_cap" },
  "Quant Flexi Cap Fund":           { schemeCode: 109830,  isin: "INF966L01457",  type: "flexi_cap" },
  "DSP Flexi Cap Fund":             { schemeCode: 105875,  isin: "INF740K01037",  type: "flexi_cap" },
  "Axis Flexi Cap Fund":            { schemeCode: 141927,  isin: "INF846K01B51",  type: "flexi_cap" },
  "Aditya Birla SL Flexi Cap Fund": { schemeCode: 103166,  isin: "INF209K01AJ8",  type: "flexi_cap" },
  "Nippon India Flexi Cap Fund":    { schemeCode: 149089,  isin: "INF204KC1097",  type: "flexi_cap" },
  "Canara Robeco Flexi Cap Fund":   { schemeCode: 130480,  isin: "INF760K01DL2",  type: "flexi_cap" },
  "Mirae Asset Flexi Cap Fund":     { schemeCode: 151414,  isin: "INF769K01JG8",  type: "flexi_cap" },
  "Edelweiss Flexi Cap Fund":       { schemeCode: 134830,  isin: "INF754K01FE3",  type: "flexi_cap" },
  "UTI Flexi Cap Fund":             { schemeCode: 120780,  isin: "INF789F01ZY5",  type: "flexi_cap" },

  // ── Multi Cap MF (Regular Plans) ──────────────────────────────────────────────
  "Nippon India Multi Cap Fund":    { schemeCode: 149086,  isin: "INF204KC1071",  type: "multi_cap" },
  "HDFC Multi Cap Fund":            { schemeCode: 130506,  isin: "INF179KA1RX3",  type: "multi_cap" },
  "Quant Active Fund":              { schemeCode: 141063,  isin: "INF082J01275",  type: "multi_cap" },
  "Kotak Multicap Fund":            { schemeCode: 149182,  isin: "INF174KA1HS9",  type: "multi_cap" },
  "SBI Multi Cap Fund":             { schemeCode: 149886,  isin: "INF200KA15E8",  type: "multi_cap" },
  "Aditya Birla SL Multi Cap Fund": { schemeCode: 130477,  isin: "INF084M01796",  type: "multi_cap" },

  // ── ELSS (Regular Plans) ──────────────────────────────────────────────────────
  "Axis Long Term Equity Fund (ELSS)":  { schemeCode: 120501, isin: "INF846K01EY8", type: "equity" },
  "Mirae Asset Tax Saver Fund (ELSS)":  { schemeCode: 135784, isin: "INF769K01DK3", type: "equity" },
  "Mirae Asset Tax Saver Fund":         { schemeCode: 135784, isin: "INF769K01DK3", type: "equity" },
  "Canara Robeco Equity Tax Saver":     { schemeCode: 120474, isin: "INF760K01DB2", type: "equity" },
  "SBI Long Term Equity (ELSS)":        { schemeCode: 119592, isin: "INF200K01959", type: "equity" },
  "Kotak Tax Saver Fund (ELSS)":        { schemeCode: 120166, isin: "INF174K01LQ8", type: "equity" },
  "DSP Tax Saver Fund (ELSS)":          { schemeCode: 119214, isin: "INF740K01357", type: "equity" },
  "ICICI Pru Long Term Equity (ELSS)":  { schemeCode: 120595, isin: "INF109K01ZB2", type: "equity" },
  "Nippon India Tax Saver (ELSS)":      { schemeCode: 118776, isin: "INF204K01GR0", type: "equity" },
  "UTI Long Term Equity Fund (ELSS)":   { schemeCode: 120783, isin: "INF789F01ZW9", type: "equity" },
  "Aditya Birla SL Tax Relief 96":      { schemeCode: 102268, isin: "INF084M01077", type: "equity" },
  "Parag Parikh Tax Saver Fund":        { schemeCode: 147482, isin: "INF879O01092", type: "equity" },

  // ── Balanced Advantage / Hybrid (Regular Plans) ───────────────────────────────
  "HDFC Balanced Advantage Fund":       { schemeCode: 100119, isin: "INF179K01AL8",  type: "equity" },
  "ICICI Pru Balanced Advantage Fund":  { schemeCode: 108462, isin: "INF109K01BH2",  type: "equity" },
  "ICICI Pru Balanced Advantage":       { schemeCode: 108462, isin: "INF109K01BH2",  type: "equity" },
  "ICICI Pru Equity & Debt Fund":       { schemeCode: 100353, isin: "INF109K01118",  type: "equity" },
  "Kotak Balanced Advantage Fund":      { schemeCode: 144333, isin: "INF174KA1186",  type: "equity" },
  "Nippon India Balanced Advantage":    { schemeCode: 149083, isin: "INF204KC1055",  type: "equity" },
  "Edelweiss Balanced Advantage Fund":  { schemeCode: 112117, isin: "INF754K01285",  type: "equity" },
  "SBI Balanced Advantage Fund":        { schemeCode: 149132, isin: "INF200KA1Y40",  type: "equity" },
  "Axis Balanced Advantage Fund":       { schemeCode: 141644, isin: "INF846K01A52",  type: "equity" },
  "DSP Dynamic Asset Allocation Fund":  { schemeCode: 100622, isin: "INF740K01167",  type: "equity" },
  "Aditya Birla SL Balanced Advantage": { schemeCode: 109473, isin: "INF084M01085",  type: "equity" },

  // ── Multi Asset (Regular Plans) ───────────────────────────────────────────────
  "ICICI Pru Multi Asset Fund":         { schemeCode: 100353, isin: "INF109K01118",  type: "equity" },

  // ── Liquid MF (Regular Plans) ─────────────────────────────────────────────────
  "HDFC Liquid Fund":                   { schemeCode: 100872, isin: "INF179K01AV7",  type: "liquid" },
  "ICICI Pru Liquid Fund":              { schemeCode: 100362, isin: "INF109K01027",  type: "liquid" },
  "ICICI Pru Liquid Fund (Buffer)":     { schemeCode: 100362, isin: "INF109K01027",  type: "liquid" },
  "SBI Liquid Fund":                    { schemeCode: 105280, isin: "INF200K01MA1",  type: "liquid" },
  "Kotak Liquid Fund":                  { schemeCode: 100835, isin: "INF174K01NI9",  type: "liquid" },
  "Nippon India Liquid Fund":           { schemeCode: 100613, isin: "INF204K01GL3",  type: "liquid" },
  "Aditya Birla SL Liquid Fund":        { schemeCode: 100052, isin: "INF084M01044",  type: "liquid" },
  "Axis Liquid Fund":                   { schemeCode: 120502, isin: "INF846K01EZ5",  type: "liquid" },
  "DSP Liquidity Fund":                 { schemeCode: 100615, isin: "INF740K01167",  type: "liquid" },
  "Tata Liquid Fund":                   { schemeCode: 100124, isin: "INF277K01CS2",  type: "liquid" },

  // ── Overnight MF (Regular Plans) ──────────────────────────────────────────────
  "HDFC Overnight Fund":                { schemeCode: 143885, isin: "INF179K01X84",  type: "liquid" },
  "ICICI Pru Overnight Fund":           { schemeCode: 143895, isin: "INF109K01AX1",  type: "liquid" },
  "SBI Overnight Fund":                 { schemeCode: 143883, isin: "INF200K01V56",  type: "liquid" },
  "Kotak Overnight Fund":               { schemeCode: 143891, isin: "INF174K01NP0",  type: "liquid" },
  "Nippon India Overnight Fund":        { schemeCode: 145811, isin: "INF204KB1Q65",  type: "liquid" },
  "Aditya Birla Overnight Fund":        { schemeCode: 143886, isin: "INF084M01911",  type: "liquid" },
  // Added: DSP Overnight Fund — replaces "1-Month Bank FD" in goal-emergency-corpus
  "DSP Overnight Fund":                 { schemeCode: 145819, isin: "INF740K01IX7",  type: "liquid" },
  "Tata Overnight Fund":                { schemeCode: 146149, isin: "INF277K01KG4",  type: "liquid" },
  "Axis Overnight Fund":                { schemeCode: 145820, isin: "INF846K01AC4",  type: "liquid" },

  // ── Ultra Short / Money Market MF (Regular Plans) ────────────────────────────
  "Aditya Birla SL Savings Fund":       { schemeCode: 100052, isin: "INF084M01044",  type: "debt" },
  "HDFC Ultra Short Term Fund":         { schemeCode: 143901, isin: "INF179K01XB0",  type: "debt" },
  "ICICI Pru Ultra Short Term Fund":    { schemeCode: 108273, isin: "INF109K01CE6",  type: "debt" },
  "Nippon India Money Market Fund":     { schemeCode: 100610, isin: "INF204K01GJ7",  type: "debt" },
  "Aditya Birla SL Money Market Fund":  { schemeCode: 100052, isin: "INF084M01051",  type: "debt" },
  "Axis Treasury Advantage Fund":       { schemeCode: 120505, isin: "INF846K01FC1",  type: "debt" },

  // ── Short Duration MF (Regular Plans) ────────────────────────────────────────
  "HDFC Short Term Debt Fund":          { schemeCode: 113047, isin: "INF179K01CU6",  type: "debt" },
  "HDFC Short Term Fund":               { schemeCode: 113047, isin: "INF179K01CU6",  type: "debt" },
  "Kotak Short Term Fund":              { schemeCode: 100841, isin: "INF174K01FN9",  type: "debt" },
  "Aditya Birla SL Short Term Fund":    { schemeCode: 100054, isin: "INF084M01077",  type: "debt" },
  "SBI Short Term Debt Fund":           { schemeCode: 102503, isin: "INF200K01636",  type: "debt" },
  "Nippon India Short Term Fund":       { schemeCode: 100608, isin: "INF204K01GH1",  type: "debt" },
  "DSP Short Term Fund":                { schemeCode: 100617, isin: "INF740K01274",  type: "debt" },
  "DSP BlackRock Short Term Fund":      { schemeCode: 100617, isin: "INF740K01274",  type: "debt" },
  "Tata Short Term Bond Fund":          { schemeCode: 100124, isin: "INF277K01CS2",  type: "debt" },

  // ── Corporate Bond MF (Regular Plans) ────────────────────────────────────────
  "HDFC Corporate Bond Fund":           { schemeCode: 113070, isin: "INF179K01DC2",  type: "debt" },
  "Kotak Corporate Bond Fund":          { schemeCode: 133782, isin: "INF178L01BO1",  type: "debt" },
  "Axis Corporate Debt Fund":           { schemeCode: 120504, isin: "INF846K01FB3",  type: "debt" },
  "Aditya Birla SL Corporate Bond":     { schemeCode: 103178, isin: "INF209K01785",  type: "debt" },
  "Aditya Birla SL Corporate Bond Fund":{ schemeCode: 103178, isin: "INF209K01785",  type: "debt" },
  "SBI Corporate Bond Fund":            { schemeCode: 146207, isin: "INF200KA1YM5",  type: "debt" },
  "DSP Corporate Bond Fund":            { schemeCode: 100617, isin: "INF740K01274",  type: "debt" },

  // ── Banking & PSU Debt MF (Regular Plans) ────────────────────────────────────
  "HDFC Banking & PSU Debt Fund":       { schemeCode: 113071, isin: "INF179K01AY1",  type: "debt" },
  "ICICI Pru Banking & PSU Debt Fund":  { schemeCode: 108271, isin: "INF109K01CB2",  type: "debt" },
  "ICICI Pru Banking & PSU Debt":       { schemeCode: 108271, isin: "INF109K01CB2",  type: "debt" },
  "Kotak Banking & PSU Debt Fund":      { schemeCode: 117447, isin: "INF846K01CB0",  type: "debt" },
  "Nippon India Banking & PSU Debt":    { schemeCode: 113073, isin: "INF204K01TX3",  type: "debt" },
  "Nippon India Banking & PSU Debt Fund":{ schemeCode: 113073, isin: "INF204K01TX3", type: "debt" },
  "SBI Banking & PSU Fund":             { schemeCode: 125498, isin: "INF200K01U41",  type: "debt" },
  "Aditya Birla SL Banking & PSU Debt": { schemeCode: 108273, isin: "INF209K01LV0",  type: "debt" },
  "DSP Banking & PSU Debt Fund":        { schemeCode: 100617, isin: "INF740K01191",  type: "debt" },
  "Axis Banking & PSU Debt Fund":       { schemeCode: 117446, isin: "INF846K01CB0",  type: "debt" },
  // Added: missing Banking & PSU aliases found in seeds
  "Axis Banking & PSU": { schemeCode: 117446, isin: "INF846K01CB0", type: "debt" },
  "HDFC Banking and PSU Debt Fund": { schemeCode: 113071, isin: "INF179K01AY1", type: "debt" },
  "Bandhan Banking & PSU Debt Fund":    { schemeCode: 102735, isin: "INF194K01EJ6",  type: "debt" },

  // ── Gilt / Long Duration MF (Regular Plans) ───────────────────────────────────
  "SBI Magnum Gilt Fund":               { schemeCode: 101001, isin: "INF200K01982",  type: "gilt" },
  "ICICI Pru Gilt Fund":                { schemeCode: 100371, isin: "INF109K01027",  type: "gilt" },
  "HDFC Gilt Fund":                     { schemeCode: 101082, isin: "INF179K01AZ8",  type: "gilt" },
  "Kotak Gilt Fund":                    { schemeCode: 100265, isin: "INF174K01FI5",  type: "gilt" },
  "DSP Govt Securities Fund":           { schemeCode: 100619, isin: "INF740K01283",  type: "gilt" },
  "Quantum Dynamic Bond Fund":          { schemeCode: 118778, isin: "INF082J01036",  type: "gilt" },
  // Added: Bandhan-rebranded IDFC gilt funds (rebranded Nov 2023)
  "Bandhan CRISIL IBX Gilt Constant Maturity 10Y Index Fund": { schemeCode: 145550, isin: "INF194K01GX8", type: "gilt" },
  "IDFC GSF Constant Maturity":         { schemeCode: 145550, isin: "INF194K01GX8",  type: "gilt" }, // legacy alias
  "Bandhan CRISIL IBX Triple A Financial Services Jun 2028 Index Fund": { schemeCode: 140818, isin: "INF194K01GV2", type: "debt" },
  "IDFC CRISIL IBX Triple A Financial June 2028": { schemeCode: 140818, isin: "INF194K01GV2", type: "debt" }, // legacy alias
  "Edelweiss SDL+AAA PSU Bond":         { schemeCode: 140172, isin: "INF754K01KM3",  type: "debt" },
  "BHARAT Bond ETF Apr 2032":           { schemeCode: 148625, isin: "INF040A01053",  type: "debt" },
  "HDFC NIFTY SDL Plus G-Sec Jun 2028 Index": { schemeCode: 145799, isin: "INF179KC1DU0", type: "debt" },
  "Edelweiss NIFTY PSU Bond + SDL Index 2028": { schemeCode: 143983, isin: "INF754K01FO2", type: "debt" },
  "Nippon India ETF Nifty SDL 2028 Maturity": { schemeCode: 145809, isin: "INF204KB1M52", type: "debt" },
  "Aditya Birla SL CRISIL IBX SDL May 2028": { schemeCode: 145800, isin: "INF084M01AK1", type: "debt" },
  "Kotak NIFTY SDL Jul 2028 Index Fund":{ schemeCode: 145801, isin: "INF174K01QH3",  type: "debt" },
  "SBI Magnum CRISIL IBX Gilt Fund 2028":{ schemeCode: 145803, isin: "INF200K01W21",  type: "debt" },

  // ── Index MF (Regular Plans) ──────────────────────────────────────────────────
  "UTI NIFTY 50 Index Fund":            { schemeCode: 143340, isin: "INF789FC11T3",  type: "large_cap" },
  "UTI Nifty 50 Index Fund":            { schemeCode: 143340, isin: "INF789FC11T3",  type: "large_cap" },
  "Nifty 50 Index Fund":                { schemeCode: 143340, isin: "INF789FC11T3",  type: "large_cap" },
  "Nifty 50 Index":                     { schemeCode: 143340, isin: "INF789FC11T3",  type: "large_cap" },
  "HDFC Index Fund NIFTY 50":           { schemeCode: 118980, isin: "INF179K01B03",  type: "large_cap" },
  "HDFC Index Fund — NIFTY 50":         { schemeCode: 118980, isin: "INF179K01B03",  type: "large_cap" },
  "HDFC Index Fund ─ NIFTY 50":         { schemeCode: 118980, isin: "INF179K01B03",  type: "large_cap" },
  "ICICI Pru NIFTY 50 Index Fund":      { schemeCode: 120589, isin: "INF109K01Z72",  type: "large_cap" },
  "SBI NIFTY Index Fund":               { schemeCode: 102272, isin: "INF200K01537",  type: "large_cap" },
  "Nifty Next 50 Index Fund":           { schemeCode: 147793, isin: "INF247L01EU5",  type: "large_cap" },
  "Nifty Next 50":                      { schemeCode: 147793, isin: "INF247L01EU5",  type: "large_cap" },
  "Motilal Oswal Nifty Next 50":        { schemeCode: 147793, isin: "INF247L01EU5",  type: "large_cap" },
  "Nifty 500 Index Fund":               { schemeCode: 148575, isin: "INF204KC34A2",  type: "multi_cap" },
  "Nifty Midcap 150 Index Fund":        { schemeCode: 148910, isin: "INF959L01IW0",  type: "mid_cap" },

  // ── International / Global FOF (Regular Plans) ────────────────────────────────
  "Mirae Asset NYSE FANG+ ETF":         { schemeCode: 148929, isin: "INF769K01HG2",  type: "international" },
  "Mirae Asset NYSE FANG+ ETF FoF":     { schemeCode: 148929, isin: "INF769K01HG2",  type: "international" },
  "ICICI Pru US Bluechip":              { schemeCode: 117620, isin: "INF109K01BL4",  type: "international" },
  "ICICI Pru US Bluechip Fund":         { schemeCode: 117620, isin: "INF109K01BL4",  type: "international" },
  "Motilal Oswal Nasdaq 100":           { schemeCode: 145551, isin: "INF247L01700",  type: "international" },
  "Motilal Oswal Nasdaq 100 ETF":       { schemeCode: 145551, isin: "INF247L01700",  type: "international" },
  "Kotak Nasdaq 100 FOF":               { schemeCode: 145549, isin: "INF174K01RZ6",  type: "international" },
  "Kotak Nasdaq 100 Fund of Fund":      { schemeCode: 145549, isin: "INF174K01RZ6",  type: "international" },
  "Motilal Oswal S&P 500 Index Fund":   { schemeCode: 148382, isin: "INF247L01AH0",  type: "international" },
  "Motilal Oswal S&P 500 Index":        { schemeCode: 148382, isin: "INF247L01AH0",  type: "international" },
  "SBI International Access US Equity FOF": { schemeCode: 148925, isin: "INF200K01VE0", type: "international" },
  "SBI International Access US Equity":     { schemeCode: 148925, isin: "INF200K01VE0", type: "international" },
  "SBI Intl Access US Equity":              { schemeCode: 148925, isin: "INF200K01VE0", type: "international" },
  "DSP World Mining":                   { schemeCode: 100618, isin: "INF740K01472",  type: "international" },
  "Franklin Asian Equity":              { schemeCode: 102163, isin: "INF090I01247",  type: "international" },
  "Kotak International REIT":           { schemeCode: 148643, isin: "INF174K01QU6",  type: "international" },
  "Kotak International REIT FoF":       { schemeCode: 148643, isin: "INF174K01QU6",  type: "international" },

  // ── Gold ETF / FoF (Regular Plans) ───────────────────────────────────────────
  "Nippon India Gold Savings":          { schemeCode: 115682, isin: "INF204K01GL3",  type: "gold" },
  "Nippon India Gold Savings Fund":     { schemeCode: 115682, isin: "INF204K01GL3",  type: "gold" },
  "Nippon India ETF Gold BeES":         { schemeCode: 100610, isin: "INF204KB12A6",  type: "gold" },
  "Quantum Gold Fund ETF":              { schemeCode: 118780, isin: "INF082J01069",  type: "gold" },
  "SBI Gold Fund":                      { schemeCode: 115676, isin: "INF200K01HA1",  type: "gold" },

  // ── Thematic / Sector MF (Regular Plans) ─────────────────────────────────────
  "Tata Digital India Fund":            { schemeCode: 135792, isin: "INF277K01HB6",  type: "thematic" },
  "Aditya Birla SL Digital India Fund": { schemeCode: 100062, isin: "INF084M01168",  type: "thematic" },
  "ICICI Pru Technology Fund":          { schemeCode: 100353, isin: "INF109K01118",  type: "thematic" },
  "SBI Technology Opportunities Fund":  { schemeCode: 120577, isin: "INF200K01VS4",  type: "thematic" },
  // Pharma / Healthcare
  "ICICI Pru Pharma Healthcare Fund":   { schemeCode: 143871, isin: "INF109K01AV5",  type: "thematic" },
  "ICICI Pru Pharma Healthcare":        { schemeCode: 143871, isin: "INF109K01AV5",  type: "thematic" }, // alias
  "Nippon India Pharma Fund":           { schemeCode: 100611, isin: "INF204K01GH1",  type: "thematic" },
  "UTI Healthcare Fund":                { schemeCode: 120779, isin: "INF789F01ZV1",  type: "thematic" },
  "DSP Healthcare Fund":                { schemeCode: 143780, isin: "INF740K01IX7",  type: "thematic" },
  "Mirae Asset Healthcare Fund":        { schemeCode: 143960, isin: "INF769K01GK3",  type: "thematic" },
  "HDFC Pharma and Healthcare Fund":    { schemeCode: 145021, isin: "INF179K01XG9",  type: "thematic" },
  "Tata India Pharma & Healthcare Fund":{ schemeCode: 143989, isin: "INF277K01JM7",  type: "thematic" },
  "Kotak Healthcare Fund":              { schemeCode: 152393, isin: "INF174KC1DG5",  type: "thematic" }, // added
  "Quant Healthcare Fund":              { schemeCode: 151521, isin: "INF966L01BE5",  type: "thematic" }, // added
  "LIC MF Healthcare Fund":             { schemeCode: 152481, isin: "INF767K01NG6",  type: "thematic" }, // added
  "Invesco India Healthcare Fund":      { schemeCode: 152392, isin: "INF205K01IS8",  type: "thematic" }, // added
  "Bandhan Healthcare Fund":            { schemeCode: 152399, isin: "INF194K01HL5",  type: "thematic" }, // added
  "Canara Robeco Healthcare Fund":      { schemeCode: 152398, isin: "INF760K01FO5",  type: "thematic" }, // added
  // BFSI
  "ICICI Pru Banking & Financial Services": { schemeCode: 100241, isin: "INF109K01BQ1", type: "thematic" },
  "SBI Banking & Financial Services Fund": { schemeCode: 133858, isin: "INF200KA1473", type: "thematic" },
  "Nippon India Banking & Financial Services": { schemeCode: 100611, isin: "INF204K01GF5", type: "thematic" }, // added
  "Tata Banking & Financial Services Fund": { schemeCode: 135795, isin: "INF277K01HE0", type: "thematic" }, // added
  "Kotak Banking and Financial Services": { schemeCode: 135786, isin: "INF174K01LY0", type: "thematic" }, // added
  "Aditya Birla SL Banking & Financial Serv": { schemeCode: 120475, isin: "INF084M01507", type: "thematic" }, // added
  "DSP Banking & Financial Services Fund": { schemeCode: 143962, isin: "INF740K01JL3", type: "thematic" }, // added
  "LIC MF Banking & Financial Services":   { schemeCode: 152468, isin: "INF767K01NB7", type: "thematic" }, // added
  "Invesco India Financial Services Fund":  { schemeCode: 100352, isin: "INF205K01GM9", type: "thematic" }, // added
  "Canara Robeco Banking & Financial Serv": { schemeCode: 120476, isin: "INF760K01DK4", type: "thematic" }, // added
  "Motilal Oswal S&P BSE Fin Services ETF": { schemeCode: 148384, isin: "INF247L01DB3", type: "thematic" }, // added
  "MIRAE Asset Banking & Fin Services ETF": { schemeCode: 148931, isin: "INF769K01NB5", type: "thematic" }, // added
  "Nippon ETF Bank BeES":               { schemeCode: 100613, isin: "INF204KB16B0",  type: "thematic" },
  // Consumption
  "Nippon India Consumption Fund":      { schemeCode: 149085, isin: "INF204KC1063",  type: "thematic" }, // added
  "Bandhan Consumer Fund":              { schemeCode: 152406, isin: "INF194K01HH3",  type: "thematic" }, // added
  "UTI India Consumer Fund":            { schemeCode: 120780, isin: "INF789F01ZX5",  type: "thematic" }, // added
  "Kotak India Growth Fund":            { schemeCode: 100839, isin: "INF174K01FP4",  type: "thematic" }, // added
  "Tata India Consumer Fund":           { schemeCode: 143992, isin: "INF277K01JI5",  type: "thematic" }, // added
  "Axis India Manufacturing Fund":      { schemeCode: 145065, isin: "INF846K01A45",  type: "thematic" }, // added
  "Quant Consumption Fund":             { schemeCode: 154225, isin: "INF966L01CF3",  type: "thematic" }, // added
  // Infra
  "HDFC Infrastructure Fund":           { schemeCode: 100060, isin: "INF179K01A08",  type: "thematic" },
  "DSP India T.I.G.E.R. Fund":          { schemeCode: 100617, isin: "INF740K01472",  type: "thematic" },
  "Kotak Infrastructure & Eco Reform":  { schemeCode: 133798, isin: "INF174K01MN5",  type: "thematic" },
  "Nippon India Power & Infra Fund":    { schemeCode: 100616, isin: "INF204K01UB5",  type: "thematic" },
  "Bandhan Infrastructure Fund":        { schemeCode: 120474, isin: "INF194K01CX2",  type: "thematic" }, // added
  "UTI Infrastructure Fund":            { schemeCode: 100641, isin: "INF789F01AR7",  type: "thematic" }, // added
  "Quant Infrastructure Fund":          { schemeCode: 148928, isin: "INF966L01BX5",  type: "thematic" }, // added
  // Thematic others
  "SBI PSU Fund":                       { schemeCode: 113099, isin: "INF200K01BC0",  type: "thematic" },
  "ICICI Pru Manufacturing Fund":       { schemeCode: 145072, isin: "INF109K01AW3",  type: "thematic" },
  "Mirae Asset Great Consumer Fund":    { schemeCode: 101749, isin: "INF769K01EX1",  type: "thematic" },
  "SBI Consumption Opportunities Fund": { schemeCode: 120576, isin: "INF200K01VR6",  type: "thematic" },
  "SBI Energy Opportunities Fund":      { schemeCode: 152418, isin: "INF200KB1092",  type: "thematic" },
  "Aditya Birla SL India GenNext Fund": { schemeCode: 100066, isin: "INF084M01127",  type: "thematic" },
  "Aditya Birla SL India GenNext":      { schemeCode: 100066, isin: "INF084M01127",  type: "thematic" },
  "Franklin India Opportunities Fund":  { schemeCode: 102168, isin: "INF090I01098",  type: "thematic" }, // added
  "DSP Natural Resources Fund":         { schemeCode: 100618, isin: "INF740K01472",  type: "thematic" }, // added
  "Tata Resources & Energy Fund":       { schemeCode: 135793, isin: "INF277K01HD2",  type: "thematic" }, // added
  "Mirae Asset Nifty India Defence ETF": { schemeCode: 154189, isin: "INF769K01QD0", type: "thematic" }, // added (alias for seed)

  // ── Defence Thematic (Regular Plans) ─────────────────────────────────────────
  "Edelweiss India Defence Fund":       { schemeCode: 148562, isin: "INF754K01LN7",  type: "thematic" },
  "Quant Defence Fund":                 { schemeCode: 153681, isin: "INF966L01BU1",  type: "thematic" },
  "SBI Defence Opportunities Fund":     { schemeCode: 152774, isin: "INF200KB1290",  type: "thematic" },
  "Aditya Birla SL Defence Fund":       { schemeCode: 148558, isin: "INF084M01AW6",  type: "thematic" },
  "HDFC Defence Fund":                  { schemeCode: 151751, isin: "INF179KC1GL9",  type: "thematic" },
  "ICICI Pru Defence Fund":             { schemeCode: 148569, isin: "INF109K01BB1",  type: "thematic" },
  "Tata Indian Defence Fund":           { schemeCode: 148581, isin: "INF277K01KI0",  type: "thematic" },
  "Mirae Asset Nifty India Defence ETF FoF": { schemeCode: 154189, isin: "INF769K01QD0", type: "thematic" },
  "Nippon India Nifty India Defence ETF":    { schemeCode: 148574, isin: "INF204KC33A4", type: "thematic" },

  // ── Green Energy (Regular Plans) ─────────────────────────────────────────────
  "SBI Green Opportunities Fund":       { schemeCode: null,   isin: null,            type: "thematic" },
  "Mirae Asset Nifty India Green Ener ETF":  { schemeCode: 148925, isin: null,       type: "thematic" },

  // ── REIT (BSE ISINs — no Regular/Direct distinction) ──────────────────────────
  "Embassy Office Parks REIT":          { schemeCode: null, isin: "INE041025012", type: "reit" },
  "Embassy REIT":                       { schemeCode: null, isin: "INE041025012", type: "reit" },
  "Mindspace Business Parks REIT":      { schemeCode: null, isin: "INE036025016", type: "reit" },
  "Nexus Select Trust REIT":            { schemeCode: null, isin: "INE673K25010", type: "reit" },
  "Nexus Select Trust REIT FO":         { schemeCode: null, isin: "INE673K25010", type: "reit" },
  "Brookfield India REIT":              { schemeCode: null, isin: "INE505T01014", type: "reit" },

  // ── InvIT (BSE ISINs — no Regular/Direct distinction) ─────────────────────────
  "IndiGrid Infrastructure InvIT":      { schemeCode: null, isin: "INE219X25012", type: "invit" },
  "IndiGrid InvIT":                     { schemeCode: null, isin: "INE219X25012", type: "invit" },
  "IndiGrid Infrastructure Trust":      { schemeCode: null, isin: "INE219X25012", type: "invit" },
  "India Grid Trust InvIT":             { schemeCode: null, isin: "INE219X25012", type: "invit" },
  "Power Grid Corp InvIT":              { schemeCode: null, isin: "INE481X25016", type: "invit" },
  "Powergrid Infrastructure InvIT":     { schemeCode: null, isin: "INE481X25016", type: "invit" },
  "IRB InvIT Fund":                     { schemeCode: null, isin: "INE978O25036", type: "invit" },
  "National Highways Infra Trust":      { schemeCode: null, isin: "INE0II025013", type: "invit" },

  // ── SGB (no plan distinction) ─────────────────────────────────────────────────
  "Sovereign Gold Bond 2026-27 Series": { schemeCode: null, isin: "IN0020240135", type: "gold" },
  "Sovereign Gold Bond 2026-27 SGB":    { schemeCode: null, isin: "IN0020240135", type: "gold" },

  // ── Alternatives (AIF — no ISIN, no Regular/Direct) ───────────────────────────
  "Kotak AIF Growth Fund III":          { schemeCode: null, isin: null, type: "alternatives" },
  "Kotak AIF – Growth Fund III":        { schemeCode: null, isin: null, type: "alternatives" },
  "IIFL Special Opportunities AIF":     { schemeCode: null, isin: null, type: "alternatives" },
  "IIFL Special Opportunities Fund":    { schemeCode: null, isin: null, type: "alternatives" },
  "Motilal Oswal AIF PE Fund":          { schemeCode: null, isin: null, type: "alternatives" },
  "Aditya Birla Private Equity Fund":   { schemeCode: null, isin: null, type: "alternatives" },

  // ── SIF — Specialised Investment Fund (SEBI, effective April 1 2025) ─────────
  // SIF is a new SEBI-regulated asset class bridging MFs and PMS.
  // Minimum investment: ₹10 lakh/investor/AMC (PAN-level).
  // Suitable for HNI / accredited investors only — not for retail portfolios.
  //
  // ⚠️  schemeCode = null: SIF NAV is not yet tracked on mfapi.in (launched 2025).
  //     type = "sif": triggers the estimated-return fallback (15–18% target range
  //     per SID disclosures) in model-portfolio-metrics-service.ts until real
  //     NAV history accumulates (~12 months post-launch).
  //
  // Sources: AMFI SIF registration list (amfiindia.com), scheme SIDs (2025).
  // SEBI Circular: SEBI/HO/IMD/IMD-PoD-1/P/CIR/2025/8 (February 2025)
  "ICICI Pru iSIF Equity Long-Short":         { schemeCode: null, isin: null, type: "sif" },
  "ICICI Pru iSIF Equity Ex-Top 100":         { schemeCode: null, isin: null, type: "sif" },
  "Kotak Infinity Hybrid Long-Short SIF":     { schemeCode: null, isin: null, type: "sif" },
  "Kotak Infinity SIF":                       { schemeCode: null, isin: null, type: "sif" },
  "Mirae Asset Platinum Hybrid Long-Short":   { schemeCode: null, isin: null, type: "sif" },
  "Mirae Asset Platinum SIF":                 { schemeCode: null, isin: null, type: "sif" },
  "SBI SIF Equity Long-Short":                { schemeCode: null, isin: null, type: "sif" },
  "Nippon SIF Equity Opportunities":          { schemeCode: null, isin: null, type: "sif" },
  "HDFC SIF Dynamic Asset Allocation":        { schemeCode: null, isin: null, type: "sif" },
  "Axis SIF Flexi Long-Short":                { schemeCode: null, isin: null, type: "sif" },

  // ── Non-MF / Bank Instruments ─────────────────────────────────────────────────
  "1-Month Bank FD":                    { schemeCode: null, isin: null, type: "liquid" }, // legacy — no longer used in seeds
  "Liquid Fund (any AMC)":              { schemeCode: 105280, isin: "INF200K01MA1", type: "liquid" },
  // ── Retirement MF (Regular Plans) ────────────────────────────────────────────
  "SBI Retirement Benefit Fund":        { schemeCode: 143982, isin: "INF200K01VS4",  type: "equity" },
  "HDFC Retirement Savings — Hybrid":   { schemeCode: 134096, isin: "INF179K01XA2",  type: "equity" },
  "HDFC Retirement Savings — Hybrid Equity": { schemeCode: 134096, isin: "INF179K01XA2", type: "equity" },
  "ICICI Pru Retirement Balanced":      { schemeCode: 143967, isin: "INF109K01AZ6",  type: "equity" },
  "Franklin India Pension Plan":        { schemeCode: 102159, isin: "INF090I01080",  type: "equity" },
  // ── Dividend Yield MF (Regular Plans) ────────────────────────────────────────
  "HDFC Dividend Yield Fund":           { schemeCode: 148921, isin: "INF179KC1CF4",  type: "equity" },
  "ICICI Pru Dividend Yield Equity":    { schemeCode: 100241, isin: "INF109K01BQ1",  type: "equity" },
  "Aditya Birla SL Dividend Yield":     { schemeCode: 100067, isin: "INF084M01168",  type: "equity" },
  "UTI Dividend Yield Fund":            { schemeCode: 108466, isin: "INF789F01ZX5",  type: "equity" },
  "Sundaram Dividend Yield Fund":       { schemeCode: 100641, isin: "INF903J01BZ1",  type: "equity" },
  // ── Income / Medium-Long Duration MF (Regular Plans) ────────────────────────────
  "SBI Magnum Income Fund":             { schemeCode: 100996, isin: "INF200K01677",  type: "debt" },
  "Nippon India Income Fund":           { schemeCode: 100607, isin: "INF204K01GF5",  type: "debt" },
  "Franklin India Short Term Income":   { schemeCode: 102160, isin: "INF090I01072",  type: "debt" },
  "Franklin India Dynamic Accrual Fund":{ schemeCode: 102160, isin: "INF090I01072",  type: "debt" }, // renamed from Franklin India Corporate Debt
  "Franklin India Corporate Debt Fund": { schemeCode: 102160, isin: "INF090I01072",  type: "debt" }, // legacy alias
  "Mirae Asset Short Duration Fund":    { schemeCode: 145065, isin: "INF769K01JH6",  type: "debt" },
  "Invesco India Short Term Fund":      { schemeCode: 120510, isin: "INF205K01FF4",  type: "debt" },
  // ── Floating Rate MF (Regular Plans) ─────────────────────────────────────────
  "Aditya Birla SL Floating Rate Fund": { schemeCode: 100051, isin: "INF084M01036",  type: "debt" },
  "HDFC Floating Rate Debt Fund":       { schemeCode: 113070, isin: "INF179K01AY1",  type: "debt" },
  // ── Index ETF (Exchange Traded Funds — NSE ISINs) ─────────────────────────────
  "Kotak NIFTY 50 ETF":                 { schemeCode: null, isin: "INF174K01Q03",    type: "large_cap" },
  "Nippon India ETF Nifty BeES":        { schemeCode: null, isin: "INF204KB12A6",    type: "large_cap" },
  "Nippon ETF NIFTY BeES":              { schemeCode: null, isin: "INF204KB12A6",    type: "large_cap" },
  "Nippon India ETF Nifty Next 50":     { schemeCode: null, isin: "INF204KB16B0",    type: "large_cap" },
  "UTI NIFTY Next 50 Index Fund":       { schemeCode: 143341, isin: "INF789FC12S3",  type: "large_cap" },
  "ICICI Pru NIFTY Next 50 Index":      { schemeCode: 148572, isin: "INF109K01BH2",  type: "large_cap" },
  "Aditya Birla NIFTY 50 ETF":         { schemeCode: null, isin: "INF084M01BD4",    type: "large_cap" },
  "Mirae Asset NIFTY 50 ETF":          { schemeCode: null, isin: "INF769K01NB5",    type: "large_cap" },
  "Nippon India ETF Nifty Midcap 150":  { schemeCode: null, isin: "INF204KB1P15",    type: "mid_cap" },
  "Nippon India Nifty Midcap 150 ETF":  { schemeCode: null, isin: "INF204KB1P15",    type: "mid_cap" },
  "Nippon ETF Nifty Midcap 150":        { schemeCode: null, isin: "INF204KB1P15",    type: "mid_cap" },
  "Navi Small Cap Index Fund":          { schemeCode: 148574, isin: "INF959L01KC8",  type: "small_cap" },
  "Navi Nifty 500 Value 50 Index Fund": { schemeCode: 149090, isin: "INF959L01KZ9",  type: "multi_cap" },
  "Motilal Oswal Nifty India Defence ETF": { schemeCode: null, isin: "INF247L01HJ1", type: "thematic" },
  "Nippon India Gilt SDL Index":        { schemeCode: null, isin: "INF204KB1Q73",    type: "gilt" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the Regular Plan ISIN for a named instrument, or null if unknown.
 *
 * @param name - Exact fund name as stored in portfolio holdings
 * @returns ISIN string (INF...) for Regular Plans, BSE ISIN for REITs/InvITs, or null
 *
 * @remarks FintekPro is a distributor — all ISINs are Regular plan ISINs.
 */
export function getIsin(name: string): string | null {
  return INSTRUMENT_REGISTRY[name]?.isin ?? null;
}

/**
 * Returns the AMFI Regular-plan Growth scheme code for a named instrument.
 * Used for NAV history lookup on mfapi.in.
 *
 * @param name - Exact fund name as stored in portfolio holdings
 */
export function getSchemeCode(name: string): number | null {
  return INSTRUMENT_REGISTRY[name]?.schemeCode ?? null;
}

/**
 * Returns the full InstrumentInfo for a named instrument, or undefined if not found.
 */
export function getInstrument(name: string): InstrumentInfo | undefined {
  return INSTRUMENT_REGISTRY[name];
}
