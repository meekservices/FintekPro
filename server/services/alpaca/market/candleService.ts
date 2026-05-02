import { alpacaMarketDataService } from '../core/alpacaMarketDataService';
import { logger } from '../../../../logger';

export class CandleService {
  
  /**
   * Fetch historical candlestick data for charts
   */
  async getCandles(symbol: string, timeframe: string = '1Day', start: string, end?: string) {
    logger.info(`[CandleService] Fetching ${timeframe} candles for ${symbol} from ${start}`);

    try {
      const bars = await alpacaMarketDataService.getHistoricalBars(symbol, timeframe, start, end);
      
      // Map to standard OHLCV format
      return bars.map((bar: any) => ({
        time: bar.t,
        open: bar.o,
        high: bar.h,
        low: bar.l,
        close: bar.c,
        volume: bar.v,
        vwap: bar.vw // Volume Weighted Average Price (very useful for charting/analysis)
      }));
    } catch (error) {
      logger.error(`[CandleService] Failed to fetch candles for ${symbol}`, error);
      throw new Error(`Could not fetch historical data for ${symbol}.`);
    }
  }
}

export const candleService = new CandleService();
