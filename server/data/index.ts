/**
 * FintekPro Data Layer — Domain Storage Index
 *
 * This barrel file composes domain-specific storage facades over the central
 * DatabaseStorage class. All 182 import sites continue to use:
 *
 *   import { storage } from "../storage";           // unchanged
 *   import { storage } from "../../storage";         // unchanged
 *
 * Domain-aware code can also import directly from domain facades:
 *
 *   import { authStorage } from "../data";
 *   import { portfolioStorage } from "../data";
 *
 * Architecture:
 *   DatabaseStorage (server/storage.ts)  ← single source of truth
 *         ↓  wrapped by domain facades
 *   authStorage · portfolioStorage · mfStorage · kycStorage · bondStorage · taxStorage
 *         ↓  re-exported via this barrel
 *   server/data/index.ts
 *
 * @module data
 */

export { storage } from "../storage";

export { authStorage } from "./auth-storage";
export { portfolioStorage } from "./portfolio-storage";
export { mfStorage } from "./mf-storage";
export { kycStorage } from "./kyc-storage";
export { bondStorage } from "./bond-storage";
export { taxStorage } from "./tax-storage";
