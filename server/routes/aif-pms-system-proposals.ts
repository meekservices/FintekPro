import { Express } from "express";
import { registerAIFPMSSystemPart1Routes } from "./aif-pms-system-proposals-1";
import { registerAIFPMSSystemPart2Routes } from "./aif-pms-system-proposals-2";
import { registerAIFPMSSystemPart3Routes } from "./aif-pms-system-proposals-3";

export function registerAIFPMSSystemRoutes(app: Express): void {
	registerAIFPMSSystemPart1Routes(app);
	registerAIFPMSSystemPart2Routes(app);
	registerAIFPMSSystemPart3Routes(app);
}
