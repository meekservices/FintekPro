import { logger } from "../../../logger";
import { alpacaClient } from "../core/alpacaClient";
import moment from "moment";

export class AlpacaOptionsService {
	/**
	 * Generates an OSI compliant symbol string.
	 * Format: SYMBOL + YYMMDD + C/P + STRIKE(00000000)
	 */
	generateOsiSymbol(
		underlying: string,
		expiry: string,
		type: "C" | "P",
		strike: number,
	) {
		const symbolPart = underlying.padEnd(6, " ").toUpperCase();
		const datePart = moment(expiry).format("YYMMDD");
		const strikePart = (strike * 1000).toString().padStart(8, "0");
		return `${symbolPart}${datePart}${type}${strikePart}`.replace(/\s/g, "");
	}

	/**
	 * Fetches the option chain for a given underlying symbol.
	 */
	async getOptionChain(underlying: string) {
		try {
			const response = await alpacaClient.call(
				`/v1beta1/options/chain/${underlying.toUpperCase()}`,
				"GET",
			);
			return response;
		} catch (error: any) {
			logger.error(
				`[AlpacaOptionsService] Failed to fetch option chain for ${underlying}`,
				error.response?.data || error.message,
			);
			throw error;
		}
	}

	/**
	 * Fetches snapshots for specific option symbols.
	 */
	async getOptionSnapshots(symbols: string[]) {
		try {
			const response = await alpacaClient.call(
				`/v1beta1/options/snapshots?symbols=${symbols.join(",")}`,
				"GET",
			);
			return response;
		} catch (error: any) {
			logger.error(
				`[AlpacaOptionsService] Failed to fetch option snapshots`,
				error.response?.data || error.message,
			);
			throw error;
		}
	}
}

export const alpacaOptionsService = new AlpacaOptionsService();
