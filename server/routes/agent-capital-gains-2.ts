import { Express } from 'express';
import { registerAgentCapitalGainPart2Part1Routes } from './agent-capital-gains-2-1';
import { registerAgentCapitalGainPart2Part2Routes } from './agent-capital-gains-2-2';

export function registerAgentCapitalGainPart2Routes(app: Express): void {
  registerAgentCapitalGainPart2Part1Routes(app);
  registerAgentCapitalGainPart2Part2Routes(app);
}
