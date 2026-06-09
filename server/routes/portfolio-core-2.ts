import { Express } from "express";
import { registerPortfolioCorPart2Part1Routes } from "./portfolio-core-2-1";
import { registerPortfolioCorPart2Part2Routes } from "./portfolio-core-2-2";

export function registerPortfolioCorPart2Routes(app: Express): void {
	registerPortfolioCorPart2Part1Routes(app);
	registerPortfolioCorPart2Part2Routes(app);
}
