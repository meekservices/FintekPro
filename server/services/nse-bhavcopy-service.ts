/**
 * NSE Official Bhavcopy Ingestion Service
 *
 * Downloads and ingests daily official National Stock Exchange (NSE) settlement Bhavcopy
 * directly from NSE public archives into:
 *   1. Cloud SQL Postgres (`listed_stocks`) — authoritative EOD close, previous close, day change %, ISIN.
 *   2. BigQuery Warehouse (`stock_eod_timeseries`) — historical daily bars for factor and quant models.
 *
 * Cost: ₹0 (GCP Native, zero external subscription dependencies).
 * Schedule: Executes nightly via Cloud Run Job `fintekpro-enrichment`.
 *
 * @module nse-bhavcopy-service
 * @version 1.0.0
 */

import https from "node:https";
import zlib from "node:zlib";
import { db } from "../db";
import { sql } from "drizzle-orm";
import { logger } from "../logger";
import {
	BigQueryTimeSeriesService,
	type StockEodPoint,
} from "./bigquery-timeseries-service";

export interface BhavcopyRecord {
	tradeDate: string; // YYYY-MM-DD
	symbol: string;
	series: string;
	isin: string;
	companyName: string;
	open: number;
	high: number;
	low: number;
	close: number;
	prevClose: number;
	lastPrice: number;
	volume: number;
	turnover: number;
}

export interface BhavcopySyncResult {
	success: boolean;
	tradeDate: string;
	totalRecords: number;
	updatedStocks: number;
	bigQueryInserted: number;
	sourceUrl: string;
	latencyMs: number;
	error?: string;
}

export class NseBhavcopyService {
	private static instance: NseBhavcopyService;

	public static getInstance(): NseBhavcopyService {
		if (!NseBhavcopyService.instance) {
			NseBhavcopyService.instance = new NseBhavcopyService();
		}
		return NseBhavcopyService.instance;
	}

	/**
	 * Decompresses the first file in a standard ZIP buffer using Node zlib inflateRawSync.
	 */
	private unzipFirstFile(buf: Buffer): string {
		if (buf.length < 30 || buf.readUInt32LE(0) !== 0x04034b50) {
			throw new Error("Invalid ZIP header received from NSE archive");
		}
		const compMethod = buf.readUInt16LE(8);
		const compSize = buf.readUInt32LE(18);
		const fnLen = buf.readUInt16LE(26);
		const extraLen = buf.readUInt16LE(28);
		const offset = 30 + fnLen + extraLen;

		const rawData = buf.subarray(offset, offset + compSize);
		if (compMethod === 8) {
			return zlib.inflateRawSync(rawData).toString("utf-8");
		} else if (compMethod === 0) {
			return rawData.toString("utf-8");
		} else {
			throw new Error(`Unsupported ZIP compression method: ${compMethod}`);
		}
	}

	/**
	 * Calculates candidate trading dates in YYYYMMDD format (skipping weekends).
	 */
	public getCandidateDates(daysBack = 5): string[] {
		const dates: string[] = [];
		const now = new Date();
		// IST is UTC + 5.5 hours
		const istMs = now.getTime() + 5.5 * 60 * 60 * 1000;
		const istDate = new Date(istMs);

		const currentIstHour = istDate.getUTCHours();
		const currentIstMin = istDate.getUTCMinutes();
		// NSE typically uploads Bhavcopy between 18:00 and 18:45 IST
		const isTodayReady =
			currentIstHour > 18 || (currentIstHour === 18 && currentIstMin >= 30);

		const startOffset = isTodayReady ? 0 : 1;
		for (let i = startOffset; i < startOffset + daysBack; i++) {
			const d = new Date(istMs - i * 24 * 60 * 60 * 1000);
			const dayOfWeek = d.getUTCDay(); // 0 = Sun, 6 = Sat
			if (dayOfWeek !== 0 && dayOfWeek !== 6) {
				const y = d.getUTCFullYear();
				const m = String(d.getUTCMonth() + 1).padStart(2, "0");
				const day = String(d.getUTCDate()).padStart(2, "0");
				dates.push(`${y}${m}${day}`);
			}
		}
		return dates;
	}

	/**
	 * Downloads the Bhavcopy ZIP from NSE archives for a specific date (YYYYMMDD).
	 */
	public async fetchBhavcopyZip(
		dateStr: string,
	): Promise<{ csv: string; url: string } | null> {
		const url = `https://nsearchives.nseindia.com/content/cm/BhavCopy_NSE_CM_0_0_0_${dateStr}_F_0000.csv.zip`;

		return new Promise((resolve) => {
			const req = https.get(
				url,
				{
					headers: {
						"User-Agent":
							"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
						Accept: "*/*",
					},
					timeout: 20_000,
				},
				(res) => {
					if (res.statusCode !== 200) {
						res.resume(); // consume response data to free up memory
						return resolve(null);
					}

					const chunks: Buffer[] = [];
					res.on("data", (chunk: Buffer) => chunks.push(chunk));
					res.on("end", () => {
						try {
							const fullBuffer = Buffer.concat(chunks);
							const csv = this.unzipFirstFile(fullBuffer);
							resolve({ csv, url });
						} catch (err: any) {
							logger.warn(`[NseBhavcopy] Failed to extract zip for ${dateStr}`, {
								error: err?.message,
							});
							resolve(null);
						}
					});
				},
			);

			req.on("error", (err) => {
				logger.warn(`[NseBhavcopy] Network error fetching ${url}`, {
					error: err.message,
				});
				resolve(null);
			});

			req.on("timeout", () => {
				req.destroy();
				resolve(null);
			});
		});
	}

	/**
	 * Parses Bhavcopy CSV content into structured records (filtering for listed equities).
	 */
	public parseBhavcopy(csvContent: string): BhavcopyRecord[] {
		const lines = csvContent.split("\n");
		if (lines.length < 2) return [];

		const headerLine = lines[0].trim();
		const headers = headerLine.split(",").map((h) => h.trim());

		const col = {
			tradDt: headers.indexOf("TradDt"),
			symbol: headers.indexOf("TckrSymb"),
			series: headers.indexOf("SctySrs"),
			isin: headers.indexOf("ISIN"),
			name: headers.indexOf("FinInstrmNm"),
			open: headers.indexOf("OpnPric"),
			high: headers.indexOf("HghPric"),
			low: headers.indexOf("LwPric"),
			close: headers.indexOf("ClsPric"),
			prevClose: headers.indexOf("PrvsClsgPric"),
			lastPrice: headers.indexOf("LastPric"),
			volume: headers.indexOf("TtlTradgVol"),
			turnover: headers.indexOf("TtlTrfVal"),
		};

		if (col.symbol === -1 || col.close === -1) {
			throw new Error("Required columns not found in NSE Bhavcopy CSV");
		}

		const records: BhavcopyRecord[] = [];
		// Allowed equity series on NSE: EQ (Regular), BE (Book Entry), BZ (Z group), SM (SME)
		const validSeries = new Set(["EQ", "BE", "BZ", "SM"]);

		for (let i = 1; i < lines.length; i++) {
			const line = lines[i].trim();
			if (!line) continue;

			const parts = line.split(",");
			const series = parts[col.series]?.trim();
			if (!validSeries.has(series)) continue;

			const symbol = parts[col.symbol]?.trim();
			if (!symbol) continue;

			const close = Number.parseFloat(parts[col.close]);
			if (Number.isNaN(close) || close <= 0) continue;

			const prevClose = Number.parseFloat(parts[col.prevClose]) || close;
			const open = Number.parseFloat(parts[col.open]) || close;
			const high = Number.parseFloat(parts[col.high]) || close;
			const low = Number.parseFloat(parts[col.low]) || close;
			const lastPrice = Number.parseFloat(parts[col.lastPrice]) || close;
			const volume = Number.parseInt(parts[col.volume], 10) || 0;
			const turnover = Number.parseFloat(parts[col.turnover]) || 0;

			records.push({
				tradeDate: parts[col.tradDt]?.trim(),
				symbol,
				series,
				isin: parts[col.isin]?.trim() || "",
				companyName: parts[col.name]?.trim() || symbol,
				open,
				high,
				low,
				close,
				prevClose,
				lastPrice,
				volume,
				turnover,
			});
		}

		return records;
	}

	/**
	 * Ingests the latest available official NSE Bhavcopy into Cloud SQL and BigQuery.
	 */
	public async syncLatestBhavcopy(
		specificDate?: string,
	): Promise<BhavcopySyncResult> {
		const t0 = Date.now();
		const candidateDates = specificDate ? [specificDate] : this.getCandidateDates(5);

		let fetchResult: { csv: string; url: string } | null = null;
		let effectiveDate = "";

		for (const dateStr of candidateDates) {
			logger.info(`[NseBhavcopy] Probing NSE archive for trade date ${dateStr}...`);
			const res = await this.fetchBhavcopyZip(dateStr);
			if (res) {
				fetchResult = res;
				effectiveDate = dateStr;
				break;
			}
		}

		if (!fetchResult || !effectiveDate) {
			const latencyMs = Date.now() - t0;
			return {
				success: false,
				tradeDate: "",
				totalRecords: 0,
				updatedStocks: 0,
				bigQueryInserted: 0,
				sourceUrl: "",
				latencyMs,
				error: "No Bhavcopy files available for candidate trade dates",
			};
		}

		logger.info(
			`[NseBhavcopy] Successfully retrieved Bhavcopy for ${effectiveDate} from ${fetchResult.url}`,
		);

		const records = this.parseBhavcopy(fetchResult.csv);
		logger.info(`[NseBhavcopy] Parsed ${records.length} valid equity records`);

		// 1. Batch update Cloud SQL listed_stocks
		let updatedCount = 0;
		const batchSize = 100;

		for (let i = 0; i < records.length; i += batchSize) {
			const batch = records.slice(i, i + batchSize);
			try {
				// Construct single bulk update query per batch
				const updateCases = batch
					.map((r) => {
						const change = r.close - r.prevClose;
						const changePct = r.prevClose > 0 ? (change / r.prevClose) * 100 : 0;
						return sql`SELECT 
							${r.symbol}::varchar AS sym,
							${r.close.toFixed(2)}::numeric AS price,
							${r.prevClose.toFixed(2)}::numeric AS prev_close,
							${change.toFixed(2)}::numeric AS day_change,
							${changePct.toFixed(4)}::numeric AS day_change_percent,
							${r.volume}::numeric AS vol,
							${r.isin || null}::varchar AS isin_code`;
					});

				const unionSql = sql.join(updateCases, sql` UNION ALL `);

				await db.execute(sql`
					WITH batch_data AS (${unionSql})
					UPDATE listed_stocks ls
					SET
						current_price = bd.price,
						previous_close = bd.prev_close,
						day_change = bd.day_change,
						day_change_percent = bd.day_change_percent,
						average_volume = COALESCE(bd.vol, ls.average_volume),
						isin = COALESCE(ls.isin, bd.isin_code),
						last_updated = NOW(),
						data_source = 'nse_bhavcopy'
					FROM batch_data bd
					WHERE ls.symbol = bd.sym
				`);

				updatedCount += batch.length;
			} catch (err: any) {
				logger.warn(`[NseBhavcopy] Batch update error for slice ${i}-${i + batch.length}`, {
					error: err?.message,
				});
			}
		}

		// 2. Stream historical EOD points to BigQuery Time-Series Warehouse
		let bqCount = 0;
		try {
			const bqService = BigQueryTimeSeriesService.getInstance();
			const bqPoints: StockEodPoint[] = records.map((r) => ({
				tradeDate: r.tradeDate,
				symbol: r.symbol,
				open: r.open,
				high: r.high,
				low: r.low,
				close: r.close,
				volume: r.volume,
			}));

			const bqResult = await bqService.ingestStockEodTimeseries(bqPoints);
			bqCount = bqResult.inserted;
		} catch (bqErr: any) {
			logger.warn("[NseBhavcopy] BigQuery EOD stream error (non-fatal)", {
				error: bqErr?.message,
			});
		}

		const latencyMs = Date.now() - t0;
		logger.info("[NseBhavcopy] Ingestion completed successfully", {
			event: "BHAVCOPY_INGESTION_COMPLETE",
			trade_date: effectiveDate,
			total_records: records.length,
			updated_stocks: updatedCount,
			bigquery_inserted: bqCount,
			latency_ms: latencyMs,
		});

		return {
			success: true,
			tradeDate: effectiveDate,
			totalRecords: records.length,
			updatedStocks: updatedCount,
			bigQueryInserted: bqCount,
			sourceUrl: fetchResult.url,
			latencyMs,
		};
	}
}

export const nseBhavcopyService = NseBhavcopyService.getInstance();
