import { db } from "../../db";
import { sql } from "drizzle-orm";

const snapshotCache = new Map<
	string,
	{ data: EnrichedStockSnapshot; expiresAt: number }
>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

export interface EnrichedStockSnapshot {
	symbol: string;
	fetchedAt: string;

	fundamentals: {
		peRatio: number | null;
		pbRatio: number | null;
		roe: number | null;
		roa: number | null;
		roic: number | null;
		debtToEquity: number | null;
		currentRatio: number | null;
		dividendYield: number | null;
		eps: number | null;
		evToEbitda: number | null;
		grahamNumber: number | null;
		marketCap: number | null;
		enterpriseValue: number | null;
		freeCashFlowYield: number | null;
		earningsYield: number | null;
		payoutRatio: number | null;
		revenuePerShare: number | null;
		bookValuePerShare: number | null;
		operatingCashFlowPerShare: number | null;
		freeCashFlowPerShare: number | null;
		interestCoverage: number | null;
	} | null;

	growth: {
		revenueGrowth: number | null;
		netIncomeGrowth: number | null;
		epsGrowth: number | null;
		epsDilutedGrowth: number | null;
		freeCashFlowGrowth: number | null;
		operatingIncomeGrowth: number | null;
		grossProfitGrowth: number | null;
		dividendGrowth: number | null;
		bookValueGrowth: number | null;
		threeYRevenueGrowthPerShare: number | null;
		fiveYRevenueGrowthPerShare: number | null;
	} | null;

	dcf: {
		dcfValue: number | null;
		stockPrice: number | null;
		upsidePercent: number | null;
	} | null;

	companyRating: {
		rating: string | null;
		ratingScore: number | null;
		ratingRecommendation: string | null;
		ratingDetailsDCFScore: number | null;
		ratingDetailsROEScore: number | null;
		ratingDetailsPEScore: number | null;
	} | null;

	analystTargets: {
		count: number;
		avgPriceTarget: number | null;
		latestTargets: Array<{
			analystName: string | null;
			priceTarget: number | null;
			publishedDate: string | null;
		}>;
	} | null;

	analystGrades: {
		count: number;
		latestGrades: Array<{
			gradingCompany: string | null;
			previousGrade: string | null;
			newGrade: string | null;
			action: string | null;
			publishedDate: string | null;
		}>;
	} | null;

	technicals: {
		rsi: number | null;
		sma50: number | null;
		sma200: number | null;
		ema20: number | null;
		macd: number | null;
		adx: number | null;
		indicators: Record<string, number>;
	} | null;

	institutional: {
		topHolders: Array<{
			holder: string;
			shares: number | null;
			weightPercent: number | null;
			change: number | null;
		}>;
		totalCount: number;
	} | null;

	insiderTrades: {
		recentTrades: Array<{
			reportingName: string | null;
			transactionType: string | null;
			securitiesTransacted: number | null;
			price: number | null;
			transactionDate: string | null;
		}>;
		totalCount: number;
	} | null;

	news: {
		recentNews: Array<{
			title: string | null;
			url: string | null;
			publishedDate: string | null;
			sentiment: string | null;
		}>;
	} | null;

	sectorPerformance: {
		sector: string | null;
		changesPercentage: number | null;
	} | null;

	derivedMetrics: {
		growthScore: number | null;
		qualityScore: number | null;
		valueScore: number | null;
		riskScore: number | null;
		compositeScore: number | null;
		fintekRating: number | null;
	} | null;

	/**
	 * OHLCV-computed returns and risk metrics from screener_derived_metrics.
	 * Null when screener enrichment hasn't run for this symbol yet.
	 * Used by: pick-of-day scoring, rebalancing engine, portfolio CAGR.
	 */
	performance: {
		return1W:        number | null;
		return1M:        number | null;
		return3M:        number | null;
		return6M:        number | null;
		return1Y:        number | null;
		return2Y:        number | null;
		return3Y:        number | null;
		return5Y:        number | null;
		returnYTD:       number | null;
		returnVsNifty1Y: number | null;
		beta:            number | null;
		sharpeRatio1Y:   number | null;
		maxDrawdown1Y:   number | null;
	} | null;
}

function safeNum(val: any): number | null {
	if (val == null) return null;
	const n = Number(val);
	return Number.isNaN(n) ? null : n;
}

export async function getEnrichedStockSnapshot(
	symbol: string,
): Promise<EnrichedStockSnapshot | null> {
	if (!symbol) return null;

	const upperSymbol = symbol.toUpperCase();

	const cached = snapshotCache.get(upperSymbol);
	if (cached && cached.expiresAt > Date.now()) {
		return cached.data;
	}

	try {
		const [
			keyMetricsRes,
			growthRes,
			dcfRes,
			ratingRes,
			targetsRes,
			gradesRes,
			techRes,
			instRes,
			insiderRes,
			newsRes,
			derivedRes,
		] = await Promise.all([
			db
				.execute(
					sql`SELECT * FROM screener_key_metrics WHERE symbol = ${upperSymbol} ORDER BY date DESC LIMIT 1`,
				)
				.catch(() => ({ rows: [] })),
			db
				.execute(
					sql`SELECT * FROM screener_growth_metrics WHERE symbol = ${upperSymbol} ORDER BY date DESC LIMIT 1`,
				)
				.catch(() => ({ rows: [] })),
			db
				.execute(
					sql`SELECT * FROM screener_dcf_valuations WHERE symbol = ${upperSymbol} ORDER BY date DESC LIMIT 1`,
				)
				.catch(() => ({ rows: [] })),
			db
				.execute(
					sql`SELECT * FROM screener_company_ratings WHERE symbol = ${upperSymbol} ORDER BY date DESC LIMIT 1`,
				)
				.catch(() => ({ rows: [] })),
			db
				.execute(
					sql`SELECT * FROM screener_analyst_targets WHERE symbol = ${upperSymbol} ORDER BY published_date DESC LIMIT 5`,
				)
				.catch(() => ({ rows: [] })),
			db
				.execute(
					sql`SELECT * FROM screener_analyst_grades WHERE symbol = ${upperSymbol} ORDER BY published_date DESC LIMIT 5`,
				)
				.catch(() => ({ rows: [] })),
			db
				.execute(
					sql`SELECT * FROM screener_technical_indicators WHERE symbol = ${upperSymbol} ORDER BY date DESC LIMIT 10`,
				)
				.catch(() => ({ rows: [] })),
			db
				.execute(
					sql`SELECT * FROM screener_institutional_holders WHERE symbol = ${upperSymbol} ORDER BY date_reported DESC LIMIT 10`,
				)
				.catch(() => ({ rows: [] })),
			db
				.execute(
					sql`SELECT * FROM screener_insider_trades WHERE symbol = ${upperSymbol} ORDER BY transaction_date DESC LIMIT 5`,
				)
				.catch(() => ({ rows: [] })),
			db
				.execute(
					sql`SELECT * FROM screener_stock_news WHERE symbol = ${upperSymbol} ORDER BY published_date DESC LIMIT 5`,
				)
				.catch(() => ({ rows: [] })),
			db
				.execute(
					sql`SELECT * FROM screener_derived_metrics WHERE symbol = ${upperSymbol} LIMIT 1`,
				)
				.catch(() => ({ rows: [] })),
		]);

		const km = (keyMetricsRes as any).rows?.[0] || null;
		const gr = (growthRes as any).rows?.[0] || null;
		const dcfRow = (dcfRes as any).rows?.[0] || null;
		const rt = (ratingRes as any).rows?.[0] || null;
		const targets = (targetsRes as any).rows || [];
		const grades = (gradesRes as any).rows || [];
		const techRows = (techRes as any).rows || [];
		const instRows = (instRes as any).rows || [];
		const insiderRows = (insiderRes as any).rows || [];
		const newsRows = (newsRes as any).rows || [];
		const dm = (derivedRes as any).rows?.[0] || null;

		const hasAnyData =
			km ||
			gr ||
			dcfRow ||
			rt ||
			targets.length ||
			grades.length ||
			techRows.length ||
			dm;
		if (!hasAnyData) return null;

		const dcfValue = safeNum(dcfRow?.dcf);
		const stockPrice = safeNum(dcfRow?.stock_price);

		const techIndicators: Record<string, number> = {};
		let rsi: number | null = null;
		let sma50: number | null = null;
		let sma200: number | null = null;
		let ema20: number | null = null;
		let macd: number | null = null;
		let adx: number | null = null;

		// screener_technical_indicators is a COLUMN-based table (one row per date),
		// NOT a name/value pair table. Read each column directly.
		for (const t of techRows) {
			// Raw SQL returns DB column names (rsi_14, sma_50, etc.)
			const rsiVal = safeNum((t as any).rsi_14 ?? (t as any).rsi14 ?? (t as any).rsi);
			if (rsiVal !== null && rsi === null) { rsi = rsiVal; techIndicators["rsi"] = rsiVal; }

			const sma50Val = safeNum((t as any).sma_50 ?? (t as any).sma50);
			if (sma50Val !== null && sma50 === null) { sma50 = sma50Val; techIndicators["sma50"] = sma50Val; }

			const sma200Val = safeNum((t as any).sma_200 ?? (t as any).sma200);
			if (sma200Val !== null && sma200 === null) { sma200 = sma200Val; techIndicators["sma200"] = sma200Val; }

			const ema20Val = safeNum((t as any).ema_20 ?? (t as any).ema20);
			if (ema20Val !== null && ema20 === null) { ema20 = ema20Val; techIndicators["ema20"] = ema20Val; }

			const macdVal = safeNum((t as any).macd);
			if (macdVal !== null && macd === null) { macd = macdVal; techIndicators["macd"] = macdVal; }

			const adxVal = safeNum((t as any).adx);
			if (adxVal !== null && adx === null) { adx = adxVal; techIndicators["adx"] = adxVal; }
		}

		// Fallback for RSI: compute from goldenPrices if screener table has no data
		if (rsi === null) {
			try {
				const cutoff = new Date();
				cutoff.setDate(cutoff.getDate() - 35);
				const priceRows = await db.execute(sql`
					SELECT price FROM golden_prices
					WHERE symbol = ${upperSymbol}
					  AND price_date >= ${cutoff.toISOString().split("T")[0]}
					ORDER BY price_date ASC
					LIMIT 40
				`).catch(() => ({ rows: [] }));
				const closes = ((priceRows as any).rows || [])
					.map((r: any) => Number.parseFloat(r.price))
					.filter((n: number) => Number.isFinite(n));
				if (closes.length >= 15) {
					let gains = 0, losses = 0;
					for (let i = closes.length - 14; i < closes.length; i++) {
						const diff = closes[i] - closes[i - 1];
						if (diff > 0) gains += diff;
						else losses += Math.abs(diff);
					}
					const avgGain = gains / 14;
					const avgLoss = losses / 14;
					rsi = avgLoss === 0 ? 100 : Math.round((100 - 100 / (1 + avgGain / avgLoss)) * 100) / 100;
					if (rsi !== null) techIndicators["rsi"] = rsi;
				}
			} catch { /* non-fatal */ }
		}

		const snapshot: EnrichedStockSnapshot = {
			symbol: upperSymbol,
			fetchedAt: new Date().toISOString(),

			fundamentals: km
				? {
						peRatio: safeNum(km.pe_ratio),
						pbRatio: safeNum(km.pb_ratio),
						roe: safeNum(km.roe),
						roa: null,
						roic: safeNum(km.roic),
						debtToEquity: safeNum(km.debt_to_equity),
						currentRatio: safeNum(km.current_ratio),
						dividendYield: safeNum(km.dividend_yield),
						eps: null,
						evToEbitda: safeNum(km.enterprise_value_over_ebitda),
						grahamNumber: safeNum(km.graham_number),
						marketCap: safeNum(km.market_cap),
						enterpriseValue: safeNum(km.enterprise_value),
						freeCashFlowYield: safeNum(km.free_cash_flow_yield),
						earningsYield: safeNum(km.earnings_yield),
						payoutRatio: safeNum(km.payout_ratio),
						revenuePerShare: safeNum(km.revenue_per_share),
						bookValuePerShare: safeNum(km.book_value_per_share),
						operatingCashFlowPerShare: safeNum(
							km.operating_cash_flow_per_share,
						),
						freeCashFlowPerShare: safeNum(km.free_cash_flow_per_share),
						interestCoverage: safeNum(km.interest_coverage),
					}
				: null,

			growth: gr
				? {
						revenueGrowth: safeNum(gr.revenue_growth),
						netIncomeGrowth: safeNum(gr.net_income_growth),
						epsGrowth: safeNum(gr.eps_growth),
						epsDilutedGrowth: safeNum(gr.eps_diluted_growth),
						freeCashFlowGrowth: safeNum(gr.free_cash_flow_growth),
						operatingIncomeGrowth: safeNum(gr.operating_income_growth),
						grossProfitGrowth: safeNum(gr.gross_profit_growth),
						dividendGrowth: safeNum(gr.dividend_growth),
						bookValueGrowth: safeNum(gr.book_value_growth),
						threeYRevenueGrowthPerShare: safeNum(
							gr.three_y_revenue_growth_per_share,
						),
						fiveYRevenueGrowthPerShare: safeNum(
							gr.five_y_revenue_growth_per_share,
						),
					}
				: null,

			dcf: dcfRow
				? {
						dcfValue,
						stockPrice,
						upsidePercent:
							dcfValue != null && stockPrice != null && stockPrice > 0
								? +(((dcfValue - stockPrice) / stockPrice) * 100).toFixed(1)
								: null,
					}
				: null,

			companyRating: rt
				? {
						rating: rt.rating,
						ratingScore: safeNum(rt.rating_score),
						ratingRecommendation: rt.rating_recommendation,
						ratingDetailsDCFScore: safeNum(rt.rating_details_dcf_score),
						ratingDetailsROEScore: safeNum(rt.rating_details_roe_score),
						ratingDetailsPEScore: safeNum(rt.rating_details_pe_score),
					}
				: null,

			analystTargets:
				targets.length > 0
					? {
							count: targets.length,
							avgPriceTarget:
								targets.reduce(
									(sum: number, t: any) =>
										sum +
										(safeNum(t.adj_price_target) ||
											safeNum(t.price_target) ||
											0),
									0,
								) / targets.length || null,
							latestTargets: targets.map((t: any) => ({
								analystName: t.analyst_name,
								priceTarget:
									safeNum(t.adj_price_target) || safeNum(t.price_target),
								publishedDate: t.published_date,
							})),
						}
					: null,

			analystGrades:
				grades.length > 0
					? {
							count: grades.length,
							latestGrades: grades.map((g: any) => ({
								gradingCompany: g.grading_company,
								previousGrade: g.previous_grade,
								newGrade: g.new_grade,
								action: g.action,
								publishedDate: g.published_date,
							})),
						}
					: null,

			technicals:
				techRows.length > 0
					? {
							rsi,
							sma50,
							sma200,
							ema20,
							macd,
							adx,
							indicators: techIndicators,
						}
					: null,

			institutional:
				instRows.length > 0
					? {
							topHolders: instRows.map((h: any) => ({
								holder: h.holder,
								shares: safeNum(h.shares),
								weightPercent: safeNum(h.weight_percent),
								change: safeNum(h.change),
							})),
							totalCount: instRows.length,
						}
					: null,

			insiderTrades:
				insiderRows.length > 0
					? {
							recentTrades: insiderRows.map((t: any) => ({
								reportingName: t.reporting_name,
								transactionType: t.transaction_type,
								securitiesTransacted: safeNum(t.securities_transacted),
								price: safeNum(t.price),
								transactionDate: t.transaction_date,
							})),
							totalCount: insiderRows.length,
						}
					: null,

			news:
				newsRows.length > 0
					? {
							recentNews: newsRows.map((n: any) => ({
								title: n.title,
								url: n.url,
								publishedDate: n.published_date,
								sentiment: n.sentiment,
							})),
						}
					: null,

			sectorPerformance: null,

			derivedMetrics: dm
				? {
						growthScore: safeNum(dm.growth_score),
						qualityScore: safeNum(dm.quality_score),
						valueScore: safeNum(dm.value_score),
						riskScore: safeNum(dm.risk_score),
						compositeScore: safeNum(dm.composite_score),
						fintekRating: safeNum(dm.fintek_rating),
					}
				: null,

			// ── Fix 1: expose all OHLCV-computed returns + risk from screener_derived_metrics ──
			performance: dm
				? {
						return1W:        safeNum(dm.return_1w),
						return1M:        safeNum(dm.return_1m),
						return3M:        safeNum(dm.return_3m),
						return6M:        safeNum(dm.return_6m),
						return1Y:        safeNum(dm.return_1y),
						return2Y:        safeNum(dm.return_2y),
						return3Y:        safeNum(dm.return_3y),
						return5Y:        safeNum(dm.return_5y),
						returnYTD:       safeNum(dm.return_ytd),
						returnVsNifty1Y: safeNum(dm.return_vs_nifty_1y),
						beta:            safeNum(dm.beta),
						sharpeRatio1Y:   safeNum(dm.sharpe_ratio_1y),
						maxDrawdown1Y:   safeNum(dm.max_drawdown_1y),
					}
				: null,
		};

		snapshotCache.set(upperSymbol, {
			data: snapshot,
			expiresAt: Date.now() + CACHE_TTL_MS,
		});
		return snapshot;
	} catch (error: any) {
		console.error(
			`[EnrichedStockData] Error fetching snapshot for ${symbol}:`,
			error.message,
		);
		return null;
	}
}

export async function getEnrichedStockSnapshots(
	symbols: string[],
): Promise<Map<string, EnrichedStockSnapshot>> {
	const results = new Map<string, EnrichedStockSnapshot>();
	const batchSize = 10;

	for (let i = 0; i < symbols.length; i += batchSize) {
		const batch = symbols.slice(i, i + batchSize);
		const snapshots = await Promise.all(
			batch.map((s) => getEnrichedStockSnapshot(s)),
		);
		for (let j = 0; j < batch.length; j++) {
			if (snapshots[j]) {
				results.set(batch[j].toUpperCase(), snapshots[j]!);
			}
		}
	}

	return results;
}
