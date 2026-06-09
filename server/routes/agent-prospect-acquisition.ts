import { Express } from "express";
import { registerAgentProspectAcquisitionPart1Routes } from "./agent-prospect-acquisition-1";
import { registerAgentProspectAcquisitionPart2Routes } from "./agent-prospect-acquisition-2";

export function registerAgentProspectAcquisitionRoutes(app: Express): void {
	registerAgentProspectAcquisitionPart1Routes(app);
	registerAgentProspectAcquisitionPart2Routes(app);
}
