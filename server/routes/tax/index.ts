import { Express } from "express";
import { registerTaxPart1Routes } from "./index-1";
import { registerTaxPart2Routes } from "./index-2";

export function registerTaxRoutes(app: Express): void {
	registerTaxPart1Routes(app);
	registerTaxPart2Routes(app);
}
