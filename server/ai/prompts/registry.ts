import type { Prompt } from './index';
import { chatPrompts } from './chat';
import { portfolioPrompts } from './portfolio';
import { proposalPrompts } from './proposal';
import { kycPrompts } from './kyc';
import { compliancePrompts } from './compliance';
import { globalAdvisoryPrompts } from './global-advisory';
import { treasuryPrompts } from './treasury';


export const ALL_PROMPTS: Record<string, Prompt> = {
  ...chatPrompts,
  ...portfolioPrompts,
  ...proposalPrompts,
  ...kycPrompts,
  ...compliancePrompts,
  ...globalAdvisoryPrompts,
  ...treasuryPrompts,
};


export function getPrompt(name: string): Prompt {
  const prompt = ALL_PROMPTS[name];
  if (!prompt) {
    throw new Error(`Prompt '${name}' not found in prompt library`);
  }
  return prompt;
}

export function getPromptSystem(name: string): string {
  return getPrompt(name).systemPrompt;
}
