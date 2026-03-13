/* global CustomFunctions, OfficeRuntime */

/**
 * FintekPro Excel Custom Functions
 * Namespace: FINTEKPRO
 *
 * Usage examples:
 *   =FINTEKPRO.SPOT("NIFTY")
 *   =FINTEKPRO.OC("NIFTY","CE",24000,"2026-03-19","LTP")
 *   =FINTEKPRO.EXPIRY("NIFTY",1)
 *   =FINTEKPRO.CHAIN("NIFTY","2026-03-19")
 *   =FINTEKPRO.GREEKS("NIFTY","CE",24000,"2026-03-19")
 */

const _BASE = (() => {
  try {
    return OfficeRuntime.apiInformation?.isSetSupported
      ? window.location.origin
      : window.location.origin;
  } catch {
    return window.location.origin;
  }
})();

async function _get(path) {
  const res = await fetch(`${_BASE}${path}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new CustomFunctions.Error(CustomFunctions.ErrorCode.notAvailable, `HTTP ${res.status}`);
  return res.json();
}

// ── FINTEKPRO.SPOT ────────────────────────────────────────────────────────────
/**
 * @customfunction SPOT
 * @param {string} symbol NSE F&O symbol e.g. "NIFTY"
 * @returns {number} Current spot price
 */
async function SPOT(symbol) {
  const data = await _get(`/api/excel/spot/${encodeURIComponent(symbol.toUpperCase())}`);
  if (data?.spot == null) throw new CustomFunctions.Error(CustomFunctions.ErrorCode.notAvailable, "No spot data");
  return data.spot;
}

// ── FINTEKPRO.OC ──────────────────────────────────────────────────────────────
/**
 * @customfunction OC
 * @param {string} symbol  NSE F&O symbol
 * @param {string} type    "CE" or "PE"
 * @param {number} strike  Strike price
 * @param {string} expiry  Expiry date YYYY-MM-DD
 * @param {string} field   LTP | OI | IV | CHANGE | CHANGE_PCT | VOLUME | BID | ASK | SPOT
 * @returns {number} Requested field value
 */
async function OC(symbol, type, strike, expiry, field) {
  const sym = encodeURIComponent(symbol.toUpperCase());
  const t   = encodeURIComponent(type.toUpperCase());
  const s   = encodeURIComponent(String(strike));
  const exp = encodeURIComponent(expiry);
  const f   = encodeURIComponent((field || "LTP").toUpperCase());
  const data = await _get(`/api/excel/option/${sym}/${t}/${s}/${exp}?field=${f}`);
  if (data?.value == null) {
    throw new CustomFunctions.Error(CustomFunctions.ErrorCode.notAvailable, data?.error ?? "No data");
  }
  return data.value;
}

// ── FINTEKPRO.EXPIRY ─────────────────────────────────────────────────────────
/**
 * @customfunction EXPIRY
 * @param {string} symbol NSE F&O symbol
 * @param {number} n      Expiry index: 1 = nearest
 * @returns {string} Expiry date as YYYY-MM-DD
 */
async function EXPIRY(symbol, n) {
  const sym = encodeURIComponent(symbol.toUpperCase());
  const idx = encodeURIComponent(String(n || 1));
  const data = await _get(`/api/excel/expiry/${sym}?n=${idx}`);
  if (!data?.expiry) throw new CustomFunctions.Error(CustomFunctions.ErrorCode.notAvailable, "No expiry");
  return data.expiry;
}

// ── FINTEKPRO.CHAIN ───────────────────────────────────────────────────────────
/**
 * @customfunction CHAIN
 * @param {string} symbol NSE F&O symbol
 * @param {string} expiry Expiry date YYYY-MM-DD
 * @returns {number[][]} Full option chain as 2-D array
 */
async function CHAIN(symbol, expiry) {
  const sym = encodeURIComponent(symbol.toUpperCase());
  const exp = expiry ? `?expiry=${encodeURIComponent(expiry)}` : "";
  const data = await _get(`/api/excel/chain/${sym}${exp}`);
  if (!data?.rows?.length) throw new CustomFunctions.Error(CustomFunctions.ErrorCode.notAvailable, "Empty chain");

  // Header row
  const header = [
    "STRIKE",
    "CALL LTP", "CALL OI", "CALL IV%", "CALL CHG",
    "PUT LTP",  "PUT OI",  "PUT IV%",  "PUT CHG",
  ];

  const rows = data.rows.map(r => [
    r.strike,
    r.call_ltp ?? "", r.call_oi ?? "", r.call_iv ?? "", r.call_change ?? "",
    r.put_ltp  ?? "", r.put_oi  ?? "", r.put_iv  ?? "", r.put_change  ?? "",
  ]);

  return [header, ...rows];
}

// ── FINTEKPRO.GREEKS ──────────────────────────────────────────────────────────
/**
 * @customfunction GREEKS
 * @param {string} symbol NSE F&O symbol
 * @param {string} type   "CE" or "PE"
 * @param {number} strike Strike price
 * @param {string} expiry Expiry date YYYY-MM-DD
 * @returns {number[][]} 2-row array: header (DELTA GAMMA THETA VEGA RHO IV) + values
 */
async function GREEKS(symbol, type, strike, expiry) {
  const sym = encodeURIComponent(symbol.toUpperCase());
  const t   = encodeURIComponent(type.toUpperCase());
  const s   = encodeURIComponent(String(strike));
  const exp = encodeURIComponent(expiry);
  const data = await _get(`/api/excel/option/${sym}/${t}/${s}/${exp}?field=GREEKS`);
  const g = data?.greeks;
  if (!g) throw new CustomFunctions.Error(CustomFunctions.ErrorCode.notAvailable, "No Greeks");
  return [
    ["DELTA", "GAMMA", "THETA", "VEGA", "RHO", "IV"],
    [
      Number(g.delta?.toFixed(4) ?? 0),
      Number(g.gamma?.toFixed(6) ?? 0),
      Number(g.theta?.toFixed(4) ?? 0),
      Number(g.vega?.toFixed(4)  ?? 0),
      Number(g.rho?.toFixed(4)   ?? 0),
      Number(g.impliedVolatility?.toFixed(4) ?? 0),
    ],
  ];
}

// Register all functions
CustomFunctions.associate("SPOT",   SPOT);
CustomFunctions.associate("OC",     OC);
CustomFunctions.associate("EXPIRY", EXPIRY);
CustomFunctions.associate("CHAIN",  CHAIN);
CustomFunctions.associate("GREEKS", GREEKS);
