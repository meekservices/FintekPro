/**
 * server/routes/prospect-wizard/index.ts — Agent Prospect Wizard entry point
 *
 * This barrel aggregates all agent-prospect-wizard routes and exports
 * a single Express Router.  Currently re-exports the existing numbered
 * part files while progressive refactoring into domain sub-modules is done:
 *
 *   prospects.ts  — CRUD, search, bulk operations for prospects
 *   scoring.ts    — scoring computation, history, benchmarks
 *   readiness.ts  — readiness check, advancement, evaluation
 *   goals.ts      — prospect goals management
 *
 * @purpose  Single canonical import for all /api/agent-wizard routes
 */
import { Router } from "express";
import part1 from "../agent-prospect-wizard-1";
import part5_2 from "../agent-prospect-wizard-5-2";

const router = Router();
router.use("/", part1);
router.use("/", part5_2);

export default router;
