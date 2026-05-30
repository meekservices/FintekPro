/**
 * server/routes/unlisted/index.ts — Unlisted stocks module entry point
 *
 * This barrel aggregates all unlisted marketplace routes and exports
 * a single Express Router.  The numbered part files (unlisted-1.ts through
 * unlisted-11.ts) are progressively being refactored into the sub-modules
 * below:
 *
 *   companies.ts  — company list, search, financials, ratios, price history
 *   deals.ts      — buy requests, sell listings, deal matching, Probe42 sync
 *
 * During migration this file simply re-exports the existing aggregator so
 * the canonical import path (`./routes/unlisted`) is established immediately.
 *
 * @purpose  Single import point for all /api/unlisted routes
 */
export { default } from '../unlisted';
