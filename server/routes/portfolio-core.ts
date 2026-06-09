import { Express } from "express";
import { registerPortfolioCorPart1Routes } from "./portfolio-core-1";
import { registerPortfolioCorPart2Routes } from "./portfolio-core-2";
export { buildRequireOwnPortfolio } from "./portfolio-core-1";

export function registerPortfolioCoreRoutes(app: Express): void {
	registerPortfolioCorPart1Routes(app);
	registerPortfolioCorPart2Routes(app);
}
