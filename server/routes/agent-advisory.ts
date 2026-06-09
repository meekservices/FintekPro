import { Express } from "express";
import { registerAgentAdvisoryPart1Routes } from "./agent-advisory-1";
import { registerAgentAdvisoryPart2Routes } from "./agent-advisory-2";
import { registerAgentAdvisoryPart3Routes } from "./agent-advisory-3";
import { registerAgentAdvisoryPart4Routes } from "./agent-advisory-4";

export function registerAgentAdvisoryRoutes(app: Express): void {
	registerAgentAdvisoryPart1Routes(app);
	registerAgentAdvisoryPart2Routes(app);
	registerAgentAdvisoryPart3Routes(app);
	registerAgentAdvisoryPart4Routes(app);
}
