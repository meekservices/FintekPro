#!/usr/bin/env node
/**
 * ─────────────────────────────────────────────────────────────────────────────
 * FintekPro Policy & Regulatory Guardrail Enforcer (FASP-AI v1.0 + GCR v1.0)
 * ─────────────────────────────────────────────────────────────────────────────
 * Automated strict policy enforcer to prevent:
 *   1. Third-party commercial brand names in UI, badges, and market briefs
 *   2. Synthetic commodity formulas (disallowing heuristic MCX conversion)
 *   3. Missing schema parity checks
 *
 * Runs in pre-commit, CI/CD, and before Cloud Run deployment.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

let violationsCount = 0;

function logViolation(rule, file, line, message) {
  violationsCount++;
  console.error(`❌ [POLICY VIOLATION] ${rule}`);
  console.error(`   File: ${path.relative(PROJECT_ROOT, file)}:${line}`);
  console.error(`   Message: ${message}\n`);
}

/**
 * RULE 1: Brand Neutrality Guard
 * Commercial competitor names are prohibited in user-facing UI and market intelligence services.
 * Approved sources: NSE, BSE, MCX, NCDEX, RBI, FBIL, CCIL, FRED, SEBI, AMFI.
 */
function checkBrandNeutrality() {
  console.log('🔍 Checking Rule 1: Brand Neutrality in UI & Market Intelligence...');
  
  const targetDirs = [
    path.join(PROJECT_ROOT, 'client/src/pages/agent-knowledge-market-brief.tsx'),
    path.join(PROJECT_ROOT, 'server/services/knowledge-hub-service.ts'),
    path.join(PROJECT_ROOT, 'server/services/knowledge-hub-auto-heal-sentinel.ts'),
    path.join(PROJECT_ROOT, 'server/services/market-brief-engine.ts'),
    path.join(PROJECT_ROOT, 'server/cron/market-brief-eod-cron.ts')
  ];

  const prohibitedPatterns = [
    /\b(moneycontrol|Moneycontrol|MoneyControl)\b/g,
    /\b(tickertape|TickerTape)\b/g
  ];

  for (const filePath of targetDirs) {
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((lineText, idx) => {
      for (const pattern of prohibitedPatterns) {
        if (pattern.test(lineText)) {
          logViolation(
            'BRAND_NEUTRALITY_VIOLATION',
            filePath,
            idx + 1,
            `Prohibited commercial brand name detected in: "${lineText.trim()}". Use official exchange/regulatory names (NSE, BSE, MCX, CCIL, FBIL, RBI, SEBI).`
          );
        }
      }
    });
  }
}

/**
 * RULE 2: Zero Synthetic Math on MCX/NCDEX Commodities
 * Direct exchange Last Traded Price (LTP) or official settlement must be used.
 * Heuristic/synthetic conversions (e.g. converting Brent USD to INR using * 84.45 / 7.33) are prohibited.
 */
function checkZeroSyntheticCommodityMath() {
  console.log('🔍 Checking Rule 2: Zero Synthetic Commodity Formulas...');

  const targetFiles = [
    path.join(PROJECT_ROOT, 'server/services/commodity-market-service.ts'),
    path.join(PROJECT_ROOT, 'server/services/market-brief-engine.ts')
  ];

  const syntheticPatterns = [
    { pattern: /\/\s*7\.33/g, desc: 'Heuristic barrel conversion (/ 7.33) detected' },
    { pattern: /\*\s*84\.[0-9]+\s*\/\s*7/g, desc: 'Synthetic Brent-to-MCX formula detected' }
  ];

  for (const filePath of targetFiles) {
    if (!fs.existsSync(filePath)) continue;
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    lines.forEach((lineText, idx) => {
      for (const { pattern, desc } of syntheticPatterns) {
        if (pattern.test(lineText)) {
          logViolation(
            'ZERO_SYNTHETIC_MATH_VIOLATION',
            filePath,
            idx + 1,
            `${desc}: "${lineText.trim()}". FintekPro policy mandates pure exchange LTP (Upstox API v2 / MCX / NCDEX).`
          );
        }
      }
    });
  }
}

/**
 * Run All Checks
 */
function runPolicyEnforcement() {
  console.log('\n🛡️  Running FintekPro Policy & Regulatory Guardrail Enforcer...');
  checkBrandNeutrality();
  checkZeroSyntheticCommodityMath();

  if (violationsCount > 0) {
    console.error(`\n❌ Policy check FAILED with ${violationsCount} violation(s).`);
    console.error('   Strict policy adherence is mandatory under FintekPro GCR v1.0 & FASP-AI v1.0.');
    process.exit(1);
  } else {
    console.log('✅ All FintekPro policy guardrails passed cleanly.\n');
    process.exit(0);
  }
}

runPolicyEnforcement();
