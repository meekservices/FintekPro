import { Express } from 'express';
import { registerAgentCapitalGainPart1Part1Routes } from './agent-capital-gains-1-1';
import { registerAgentCapitalGainPart1Part2Routes } from './agent-capital-gains-1-2';

export function registerAgentCapitalGainPart1Routes(app: Express): void {
  registerAgentCapitalGainPart1Part1Routes(app);
  registerAgentCapitalGainPart1Part2Routes(app);
}
