import { Express } from "express";
import { registerTaxFilingPart1Routes } from "./tax-filing-1";
import { registerTaxFilingPart2Routes } from "./tax-filing-2";

export function registerTaxFilingRoutes(app: Express): void {
	registerTaxFilingPart1Routes(app);
	registerTaxFilingPart2Routes(app);
}
