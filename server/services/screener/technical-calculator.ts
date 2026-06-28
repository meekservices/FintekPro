/**
 * @file technical-calculator.ts
 * @description Pure computation engine for all technical indicators needed to match
 *              MoneyControl's Technical tab. All functions are pure — no DB access.
 *              Input: raw OHLCV arrays (number[]). Output: computed indicator values.
 *
 * Indicators computed:
 *   Momentum  : RSI(14), MACD(12,26,9), CCI(20), Stochastic(14,3,3), Williams %R(14), MFI(14)
 *   Trend     : SMA(10/20/50/200), EMA(10/20/50/200), ADX(14), Supertrend(10,3)
 *   Volatility: Bollinger Bands(20,2), ATR(14)
 *   Volume    : OBV, VWAP
 *   Pivots    : Classic, Fibonacci, Camarilla, Woodie
 *   Rating    : Technical Rating (aggregated signal → Strong Buy .. Strong Sell)
 *
 * @inputs  Raw OHLCV arrays (most recent last, i.e. closes[closes.length-1] = today)
 * @outputs Computed indicator values as numbers
 */

export interface OHLCVBar {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  date: string;
}

export interface TechnicalIndicators {
  // Moving Averages
  sma10: number | null;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  ema10: number | null;
  ema20: number | null;
  ema50: number | null;
  ema200: number | null;

  // Momentum
  rsi14: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHist: number | null;
  cci20: number | null;
  stochasticK: number | null;
  stochasticD: number | null;
  williamsR: number | null;
  mfi14: number | null;

  // Trend / Volatility
  adx: number | null;
  atr14: number | null;
  bollingerUpper: number | null;
  bollingerMiddle: number | null;
  bollingerLower: number | null;
  bollingerBandwidth: number | null;
  bollingerPercentB: number | null;
  supertrend: number | null;
  supertrendSignal: 'buy' | 'sell' | null;

  // Volume
  obv: number | null;
  vwap: number | null;

  // 52-Week
  weekHigh52: number | null;
  weekLow52: number | null;
  pctFrom52WHigh: number | null;
  pctFrom52WLow: number | null;

  // Rating
  technicalRating: 'Strong Buy' | 'Buy' | 'Neutral' | 'Sell' | 'Strong Sell' | null;
  bullishSignals: number;
  bearishSignals: number;
  neutralSignals: number;
}

export interface PivotLevels {
  classic: { pivot: number; r1: number; r2: number; r3: number; s1: number; s2: number; s3: number };
  fibonacci: { pivot: number; r1: number; r2: number; r3: number; s1: number; s2: number; s3: number };
  camarilla: { r1: number; r2: number; r3: number; r4: number; s1: number; s2: number; s3: number; s4: number };
  woodie: { pivot: number; r1: number; r2: number; s1: number; s2: number };
}

// ─── Simple helpers ───────────────────────────────────────────────────────────

const round4 = (n: number): number => Math.round(n * 10000) / 10000;

function sma(values: number[], period: number): number | null {
  if (values.length < period) return null;
  const slice = values.slice(-period);
  return round4(slice.reduce((a, b) => a + b, 0) / period);
}

function ema(values: number[], period: number): number[] {
  if (values.length < period) return [];
  const k = 2 / (period + 1);
  const result: number[] = [];
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result.push(prev);
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    result.push(prev);
  }
  return result;
}

function stdDev(values: number[]): number {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

// ─── RSI ─────────────────────────────────────────────────────────────────────

function computeRSI(closes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  const changes = closes.slice(1).map((c, i) => c - closes[i]);
  let avgGain = 0, avgLoss = 0;
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i];
    else avgLoss += Math.abs(changes[i]);
  }
  avgGain /= period;
  avgLoss /= period;
  for (let i = period; i < changes.length; i++) {
    avgGain = (avgGain * (period - 1) + Math.max(changes[i], 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.abs(Math.min(changes[i], 0))) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return round4(100 - (100 / (1 + rs)));
}

// ─── MACD ────────────────────────────────────────────────────────────────────

function computeMACD(closes: number[]): { macd: number | null; signal: number | null; hist: number | null } {
  if (closes.length < 35) return { macd: null, signal: null, hist: null };
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  // Align: ema12 starts at index 11, ema26 at index 25 → offset 14
  const macdLine = ema26.map((v, i) => ema12[i + 14] - v);
  const signalLine = ema(macdLine, 9);
  const lastMacd = macdLine[macdLine.length - 1];
  const lastSignal = signalLine[signalLine.length - 1];
  return {
    macd: round4(lastMacd),
    signal: round4(lastSignal),
    hist: round4(lastMacd - lastSignal),
  };
}

// ─── ATR ─────────────────────────────────────────────────────────────────────

function computeATR(highs: number[], lows: number[], closes: number[], period = 14): number | null {
  if (highs.length < period + 1) return null;
  const trs: number[] = [];
  for (let i = 1; i < highs.length; i++) {
    const hl = highs[i] - lows[i];
    const hc = Math.abs(highs[i] - closes[i - 1]);
    const lc = Math.abs(lows[i] - closes[i - 1]);
    trs.push(Math.max(hl, hc, lc));
  }
  // Wilder smoothing
  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
  }
  return round4(atr);
}

// ─── Bollinger Bands ─────────────────────────────────────────────────────────

function computeBollinger(closes: number[], period = 20, mult = 2): {
  upper: number | null; middle: number | null; lower: number | null;
  bandwidth: number | null; percentB: number | null;
} {
  if (closes.length < period) return { upper: null, middle: null, lower: null, bandwidth: null, percentB: null };
  const slice = closes.slice(-period);
  const middle = slice.reduce((a, b) => a + b, 0) / period;
  const sd = stdDev(slice);
  const upper = middle + mult * sd;
  const lower = middle - mult * sd;
  const last = closes[closes.length - 1];
  const bandwidth = middle !== 0 ? round4((upper - lower) / middle) : null;
  const percentB = upper !== lower ? round4((last - lower) / (upper - lower)) : null;
  return { upper: round4(upper), middle: round4(middle), lower: round4(lower), bandwidth, percentB };
}

// ─── CCI ─────────────────────────────────────────────────────────────────────

function computeCCI(highs: number[], lows: number[], closes: number[], period = 20): number | null {
  if (closes.length < period) return null;
  const typicalPrices = closes.map((c, i) => (highs[i] + lows[i] + c) / 3);
  const slice = typicalPrices.slice(-period);
  const meanTP = slice.reduce((a, b) => a + b, 0) / period;
  const meanDev = slice.reduce((a, b) => a + Math.abs(b - meanTP), 0) / period;
  if (meanDev === 0) return 0;
  return round4((typicalPrices[typicalPrices.length - 1] - meanTP) / (0.015 * meanDev));
}

// ─── Stochastic %K / %D ──────────────────────────────────────────────────────

function computeStochastic(highs: number[], lows: number[], closes: number[], kPeriod = 14, dPeriod = 3): {
  k: number | null; d: number | null;
} {
  if (closes.length < kPeriod) return { k: null, d: null };
  const kValues: number[] = [];
  for (let i = kPeriod - 1; i < closes.length; i++) {
    const highSlice = highs.slice(i - kPeriod + 1, i + 1);
    const lowSlice = lows.slice(i - kPeriod + 1, i + 1);
    const highest = Math.max(...highSlice);
    const lowest = Math.min(...lowSlice);
    const range = highest - lowest;
    kValues.push(range === 0 ? 50 : ((closes[i] - lowest) / range) * 100);
  }
  const kLast = round4(kValues[kValues.length - 1]);
  const dSlice = kValues.slice(-dPeriod);
  const dLast = round4(dSlice.reduce((a, b) => a + b, 0) / dSlice.length);
  return { k: kLast, d: dLast };
}

// ─── Williams %R ─────────────────────────────────────────────────────────────

function computeWilliamsR(highs: number[], lows: number[], closes: number[], period = 14): number | null {
  if (closes.length < period) return null;
  const highest = Math.max(...highs.slice(-period));
  const lowest = Math.min(...lows.slice(-period));
  const range = highest - lowest;
  if (range === 0) return -50;
  return round4(((highest - closes[closes.length - 1]) / range) * -100);
}

// ─── MFI ─────────────────────────────────────────────────────────────────────

function computeMFI(highs: number[], lows: number[], closes: number[], volumes: number[], period = 14): number | null {
  if (closes.length < period + 1) return null;
  let posFlow = 0, negFlow = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const tp = (highs[i] + lows[i] + closes[i]) / 3;
    const prevTp = (highs[i - 1] + lows[i - 1] + closes[i - 1]) / 3;
    const mf = tp * volumes[i];
    if (tp > prevTp) posFlow += mf;
    else negFlow += mf;
  }
  if (negFlow === 0) return 100;
  const mfRatio = posFlow / negFlow;
  return round4(100 - (100 / (1 + mfRatio)));
}

// ─── ADX ─────────────────────────────────────────────────────────────────────

function computeADX(highs: number[], lows: number[], closes: number[], period = 14): number | null {
  if (closes.length < period * 2) return null;
  const dxValues: number[] = [];
  let plusDM = 0, minusDM = 0, tr = 0;

  // Seed with first `period` bars
  for (let i = 1; i <= period; i++) {
    const hDiff = highs[i] - highs[i - 1];
    const lDiff = lows[i - 1] - lows[i];
    plusDM += hDiff > lDiff && hDiff > 0 ? hDiff : 0;
    minusDM += lDiff > hDiff && lDiff > 0 ? lDiff : 0;
    const hl = highs[i] - lows[i];
    const hc = Math.abs(highs[i] - closes[i - 1]);
    const lc = Math.abs(lows[i] - closes[i - 1]);
    tr += Math.max(hl, hc, lc);
  }

  for (let i = period + 1; i < highs.length; i++) {
    const hDiff = highs[i] - highs[i - 1];
    const lDiff = lows[i - 1] - lows[i];
    const pDM = hDiff > lDiff && hDiff > 0 ? hDiff : 0;
    const mDM = lDiff > hDiff && lDiff > 0 ? lDiff : 0;
    const hl = highs[i] - lows[i];
    const hc = Math.abs(highs[i] - closes[i - 1]);
    const lc = Math.abs(lows[i] - closes[i - 1]);
    const truRange = Math.max(hl, hc, lc);

    plusDM = plusDM - plusDM / period + pDM;
    minusDM = minusDM - minusDM / period + mDM;
    tr = tr - tr / period + truRange;

    const plusDI = tr > 0 ? (plusDM / tr) * 100 : 0;
    const minusDI = tr > 0 ? (minusDM / tr) * 100 : 0;
    const diSum = plusDI + minusDI;
    if (diSum > 0) dxValues.push(Math.abs(plusDI - minusDI) / diSum * 100);
  }

  if (!dxValues.length) return null;
  return round4(dxValues.slice(-period).reduce((a, b) => a + b, 0) / Math.min(dxValues.length, period));
}

// ─── Supertrend ───────────────────────────────────────────────────────────────

function computeSupertrend(highs: number[], lows: number[], closes: number[], period = 10, multiplier = 3): {
  value: number | null; signal: 'buy' | 'sell' | null;
} {
  if (closes.length < period + 1) return { value: null, signal: null };
  const atrValues: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const hl = highs[i] - lows[i];
    const hc = Math.abs(highs[i] - closes[i - 1]);
    const lc = Math.abs(lows[i] - closes[i - 1]);
    atrValues.push(Math.max(hl, hc, lc));
  }
  // Wilder smooth ATR
  let atr = atrValues.slice(0, period).reduce((a, b) => a + b) / period;
  const atrs: number[] = Array(period).fill(atr);
  for (let i = period; i < atrValues.length; i++) {
    atr = (atr * (period - 1) + atrValues[i]) / period;
    atrs.push(atr);
  }

  let supertrend = 0;
  let direction = 1; // 1 = buy, -1 = sell
  let prevSt = 0, prevDir = 1;

  for (let i = period; i < closes.length; i++) {
    const idx = i - 1; // atr index offset (atr starts at i=1)
    const hl2 = (highs[i] + lows[i]) / 2;
    const upperBand = hl2 + multiplier * atrs[idx];
    const lowerBand = hl2 - multiplier * atrs[idx];

    if (prevDir === 1) {
      supertrend = Math.max(lowerBand, prevSt);
      direction = closes[i] > supertrend ? 1 : -1;
    } else {
      supertrend = Math.min(upperBand, prevSt);
      direction = closes[i] < supertrend ? -1 : 1;
    }
    prevSt = supertrend;
    prevDir = direction;
  }

  return {
    value: round4(supertrend),
    signal: direction === 1 ? 'buy' : 'sell',
  };
}

// ─── OBV ─────────────────────────────────────────────────────────────────────

function computeOBV(closes: number[], volumes: number[]): number | null {
  if (closes.length < 2) return null;
  let obv = volumes[0];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) obv += volumes[i];
    else if (closes[i] < closes[i - 1]) obv -= volumes[i];
  }
  return Math.round(obv);
}

// ─── VWAP ─────────────────────────────────────────────────────────────────────

function computeVWAP(highs: number[], lows: number[], closes: number[], volumes: number[]): number | null {
  if (!closes.length) return null;
  let cumTPV = 0, cumVol = 0;
  for (let i = 0; i < closes.length; i++) {
    const tp = (highs[i] + lows[i] + closes[i]) / 3;
    cumTPV += tp * volumes[i];
    cumVol += volumes[i];
  }
  return cumVol > 0 ? round4(cumTPV / cumVol) : null;
}

// ─── Technical Rating ─────────────────────────────────────────────────────────

export function computeTechnicalRating(indicators: {
  rsi14: number | null;
  macd: number | null;
  macdSignal: number | null;
  stochasticK: number | null;
  stochasticD: number | null;
  cci20: number | null;
  williamsR: number | null;
  mfi14: number | null;
  close: number;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  ema20: number | null;
  bollingerUpper: number | null;
  bollingerLower: number | null;
  adx: number | null;
  supertrendSignal: 'buy' | 'sell' | null;
}): { rating: 'Strong Buy' | 'Buy' | 'Neutral' | 'Sell' | 'Strong Sell'; bullish: number; bearish: number; neutral: number } {
  let bullish = 0, bearish = 0, neutral = 0;

  // RSI: >70=overbought(bearish), <30=oversold(bullish), 30-50=bullish, 50-70=bearish relative
  if (indicators.rsi14 !== null) {
    if (indicators.rsi14 < 30) bullish++;
    else if (indicators.rsi14 > 70) bearish++;
    else if (indicators.rsi14 < 50) bullish++;
    else bearish++;
  }
  // MACD: above signal = bullish
  if (indicators.macd !== null && indicators.macdSignal !== null) {
    if (indicators.macd > indicators.macdSignal) bullish++;
    else if (indicators.macd < indicators.macdSignal) bearish++;
    else neutral++;
  }
  // Stochastic: K > D and both < 80 = bullish; K < D and both > 20 = bearish
  if (indicators.stochasticK !== null && indicators.stochasticD !== null) {
    if (indicators.stochasticK > indicators.stochasticD && indicators.stochasticK < 80) bullish++;
    else if (indicators.stochasticK < indicators.stochasticD && indicators.stochasticK > 20) bearish++;
    else neutral++;
  }
  // CCI: > 100 = bullish, < -100 = bearish
  if (indicators.cci20 !== null) {
    if (indicators.cci20 > 100) bullish++;
    else if (indicators.cci20 < -100) bearish++;
    else neutral++;
  }
  // Williams %R: > -20 = overbought(bearish), < -80 = oversold(bullish)
  if (indicators.williamsR !== null) {
    if (indicators.williamsR < -80) bullish++;
    else if (indicators.williamsR > -20) bearish++;
    else neutral++;
  }
  // MFI: < 20 = oversold(bullish), > 80 = overbought(bearish)
  if (indicators.mfi14 !== null) {
    if (indicators.mfi14 < 20) bullish++;
    else if (indicators.mfi14 > 80) bearish++;
    else neutral++;
  }
  // Price vs SMA20: above = bullish
  if (indicators.sma20 !== null) {
    if (indicators.close > indicators.sma20) bullish++;
    else bearish++;
  }
  // Price vs SMA50: above = bullish
  if (indicators.sma50 !== null) {
    if (indicators.close > indicators.sma50) bullish++;
    else bearish++;
  }
  // Price vs SMA200: above = bullish (golden cross zone)
  if (indicators.sma200 !== null) {
    if (indicators.close > indicators.sma200) bullish++;
    else bearish++;
  }
  // Price vs EMA20
  if (indicators.ema20 !== null) {
    if (indicators.close > indicators.ema20) bullish++;
    else bearish++;
  }
  // Bollinger: price above middle = bullish momentum
  if (indicators.bollingerUpper !== null && indicators.bollingerLower !== null) {
    const middle = (indicators.bollingerUpper + indicators.bollingerLower) / 2;
    if (indicators.close > middle) bullish++;
    else bearish++;
  }
  // Supertrend
  if (indicators.supertrendSignal !== null) {
    if (indicators.supertrendSignal === 'buy') bullish++;
    else bearish++;
  }

  const total = bullish + bearish + neutral;
  const bullishPct = total > 0 ? bullish / total : 0;

  let rating: 'Strong Buy' | 'Buy' | 'Neutral' | 'Sell' | 'Strong Sell';
  if (bullishPct >= 0.7) rating = 'Strong Buy';
  else if (bullishPct >= 0.55) rating = 'Buy';
  else if (bullishPct >= 0.45) rating = 'Neutral';
  else if (bullishPct >= 0.3) rating = 'Sell';
  else rating = 'Strong Sell';

  return { rating, bullish, bearish, neutral };
}

// ─── Pivot Levels ─────────────────────────────────────────────────────────────

/**
 * Computes all 4 pivot methods from previous day's OHLCV.
 * Called on-demand — no storage needed as values change daily.
 *
 * @param prevHigh  Previous session high
 * @param prevLow   Previous session low
 * @param prevClose Previous session close
 * @param prevOpen  Previous session open (used by Woodie)
 */
export function computePivotLevels(prevHigh: number, prevLow: number, prevClose: number, prevOpen?: number): PivotLevels {
  const H = prevHigh, L = prevLow, C = prevClose;
  const r = (n: number) => round4(n);

  // Classic (Standard)
  const P = (H + L + C) / 3;
  const classic = {
    pivot: r(P),
    r1: r(2 * P - L),
    r2: r(P + (H - L)),
    r3: r(H + 2 * (P - L)),
    s1: r(2 * P - H),
    s2: r(P - (H - L)),
    s3: r(L - 2 * (H - P)),
  };

  // Fibonacci
  const range = H - L;
  const fibonacci = {
    pivot: r(P),
    r1: r(P + 0.382 * range),
    r2: r(P + 0.618 * range),
    r3: r(P + 1.0 * range),
    s1: r(P - 0.382 * range),
    s2: r(P - 0.618 * range),
    s3: r(P - 1.0 * range),
  };

  // Camarilla
  const camarilla = {
    r1: r(C + range * 1.1 / 12),
    r2: r(C + range * 1.1 / 6),
    r3: r(C + range * 1.1 / 4),
    r4: r(C + range * 1.1 / 2),
    s1: r(C - range * 1.1 / 12),
    s2: r(C - range * 1.1 / 6),
    s3: r(C - range * 1.1 / 4),
    s4: r(C - range * 1.1 / 2),
  };

  // Woodie — uses current open if provided, otherwise falls back to prev close
  const open = prevOpen ?? C;
  const woodieP = (H + L + 2 * open) / 4;
  const woodie = {
    pivot: r(woodieP),
    r1: r(2 * woodieP - L),
    r2: r(woodieP + H - L),
    s1: r(2 * woodieP - H),
    s2: r(woodieP - H + L),
  };

  return { classic, fibonacci, camarilla, woodie };
}

// ─── Main compute function ────────────────────────────────────────────────────

/**
 * Computes ALL technical indicators from a sorted OHLCV array (oldest first).
 * Returns a TechnicalIndicators object ready to be upserted to screener_technical_indicators.
 */
export function computeAllIndicators(bars: OHLCVBar[]): TechnicalIndicators {
  if (!bars.length) {
    return {
      sma10: null, sma20: null, sma50: null, sma200: null,
      ema10: null, ema20: null, ema50: null, ema200: null,
      rsi14: null, macd: null, macdSignal: null, macdHist: null,
      cci20: null, stochasticK: null, stochasticD: null,
      williamsR: null, mfi14: null, adx: null, atr14: null,
      bollingerUpper: null, bollingerMiddle: null, bollingerLower: null,
      bollingerBandwidth: null, bollingerPercentB: null,
      supertrend: null, supertrendSignal: null,
      obv: null, vwap: null,
      weekHigh52: null, weekLow52: null,
      pctFrom52WHigh: null, pctFrom52WLow: null,
      technicalRating: null, bullishSignals: 0, bearishSignals: 0, neutralSignals: 0,
    };
  }

  const opens = bars.map(b => b.open);
  const highs = bars.map(b => b.high);
  const lows = bars.map(b => b.low);
  const closes = bars.map(b => b.close);
  const volumes = bars.map(b => b.volume);

  // Last 252 bars for 52W
  const bars252 = bars.slice(-252);
  const weekHigh52 = bars252.length ? Math.max(...bars252.map(b => b.high)) : null;
  const weekLow52 = bars252.length ? Math.min(...bars252.map(b => b.low)) : null;
  const lastClose = closes[closes.length - 1];
  const pctFrom52WHigh = weekHigh52 ? round4((lastClose - weekHigh52) / weekHigh52 * 100) : null;
  const pctFrom52WLow = weekLow52 ? round4((lastClose - weekLow52) / weekLow52 * 100) : null;

  const ema10Arr = ema(closes, 10);
  const ema20Arr = ema(closes, 20);
  const ema50Arr = ema(closes, 50);
  const ema200Arr = ema(closes, 200);

  const { macd: macdVal, signal: macdSignalVal, hist: macdHistVal } = computeMACD(closes);
  const boll = computeBollinger(closes);
  const stoch = computeStochastic(highs, lows, closes);
  const st = computeSupertrend(highs, lows, closes);
  const rsi14Val = computeRSI(closes);

  const indicators: TechnicalIndicators = {
    sma10: sma(closes, 10),
    sma20: sma(closes, 20),
    sma50: sma(closes, 50),
    sma200: sma(closes, 200),
    ema10: ema10Arr.length ? round4(ema10Arr[ema10Arr.length - 1]) : null,
    ema20: ema20Arr.length ? round4(ema20Arr[ema20Arr.length - 1]) : null,
    ema50: ema50Arr.length ? round4(ema50Arr[ema50Arr.length - 1]) : null,
    ema200: ema200Arr.length ? round4(ema200Arr[ema200Arr.length - 1]) : null,

    rsi14: rsi14Val,
    macd: macdVal,
    macdSignal: macdSignalVal,
    macdHist: macdHistVal,
    cci20: computeCCI(highs, lows, closes),
    stochasticK: stoch.k,
    stochasticD: stoch.d,
    williamsR: computeWilliamsR(highs, lows, closes),
    mfi14: computeMFI(highs, lows, closes, volumes),

    adx: computeADX(highs, lows, closes),
    atr14: computeATR(highs, lows, closes),
    bollingerUpper: boll.upper,
    bollingerMiddle: boll.middle,
    bollingerLower: boll.lower,
    bollingerBandwidth: boll.bandwidth,
    bollingerPercentB: boll.percentB,
    supertrend: st.value,
    supertrendSignal: st.signal,

    obv: computeOBV(closes, volumes),
    vwap: computeVWAP(highs, lows, closes, volumes),

    weekHigh52: weekHigh52 ? round4(weekHigh52) : null,
    weekLow52: weekLow52 ? round4(weekLow52) : null,
    pctFrom52WHigh,
    pctFrom52WLow,

    technicalRating: null,
    bullishSignals: 0,
    bearishSignals: 0,
    neutralSignals: 0,
  };

  // Compute rating from indicators
  const { rating, bullish, bearish, neutral } = computeTechnicalRating({
    rsi14: indicators.rsi14,
    macd: indicators.macd,
    macdSignal: indicators.macdSignal,
    stochasticK: indicators.stochasticK,
    stochasticD: indicators.stochasticD,
    cci20: indicators.cci20,
    williamsR: indicators.williamsR,
    mfi14: indicators.mfi14,
    close: lastClose,
    sma20: indicators.sma20,
    sma50: indicators.sma50,
    sma200: indicators.sma200,
    ema20: indicators.ema20,
    bollingerUpper: indicators.bollingerUpper,
    bollingerLower: indicators.bollingerLower,
    adx: indicators.adx,
    supertrendSignal: indicators.supertrendSignal,
  });

  indicators.technicalRating = rating;
  indicators.bullishSignals = bullish;
  indicators.bearishSignals = bearish;
  indicators.neutralSignals = neutral;

  return indicators;
}
