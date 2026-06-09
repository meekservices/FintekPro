import { Express } from "express";
import { registerCapitalGainPart1Routes } from "./capital-gains-1";
import { registerCapitalGainPart2Routes } from "./capital-gains-2";
import { registerCapitalGainPart3Routes } from "./capital-gains-3";

export function registerCapitalGainsRoutes(app: Express): void {
	registerCapitalGainPart1Routes(app);
	registerCapitalGainPart2Routes(app);
	registerCapitalGainPart3Routes(app);
}
