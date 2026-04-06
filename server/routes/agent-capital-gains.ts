import { Express } from 'express';
import { registerAgentCapitalGainPart1Routes } from './agent-capital-gains-1';
import { registerAgentCapitalGainPart2Routes } from './agent-capital-gains-2';
import { registerAgentCapitalGainPart3Routes } from './agent-capital-gains-3';

export function registerAgentCapitalGainsRoutes(app: Express): void {
  registerAgentCapitalGainPart1Routes(app);
  registerAgentCapitalGainPart2Routes(app);
  registerAgentCapitalGainPart3Routes(app);
}
