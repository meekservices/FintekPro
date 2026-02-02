import { Router, Request, Response } from 'express';
import { ProposalFlowGatekeeper, createPhaseValidationMiddleware } from '../services/proposal-flow-gatekeeper';
import { WhatIfSimulatorEngine } from '../services/proposal-whatif-engine';
import { GoalBenchmarkMapper } from '../services/goal-benchmark-mapper';
import { ProposalVerdictNormalizer } from '../services/proposal-verdict-normalizer';
import { ProposalSipAttribution } from '../services/proposal-sip-attribution';
import { ReportDependencyResolver } from '../services/report-dependency-resolver';
import { ReportLabelRegistry } from '../services/report-label-registry';

const router = Router();

// ===== FLOW STATE ENDPOINTS =====

router.get('/flow-state/:proposalId', async (req: Request, res: Response) => {
  try {
    const { proposalId } = req.params;
    const status = await ProposalFlowGatekeeper.getFlowStatus(proposalId);
    res.json(status);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/flow-state/:proposalId/validate', async (req: Request, res: Response) => {
  try {
    const { proposalId } = req.params;
    const { targetPhase } = req.body;
    const validation = await ProposalFlowGatekeeper.validatePhaseTransition(proposalId, targetPhase);
    res.json(validation);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/flow-state/:proposalId/complete-phase', async (req: Request, res: Response) => {
  try {
    const { proposalId } = req.params;
    const { phase } = req.body;
    const result = await ProposalFlowGatekeeper.completePhase(proposalId, phase);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/flow-state/:proposalId/validate-analysis', async (req: Request, res: Response) => {
  try {
    const { proposalId } = req.params;
    const validation = await ProposalFlowGatekeeper.validatePortfolioAnalysis(proposalId);
    res.json(validation);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/flow-state/:proposalId/validate-report', async (req: Request, res: Response) => {
  try {
    const { proposalId } = req.params;
    const validation = await ProposalFlowGatekeeper.validateReportGeneration(proposalId);
    res.json(validation);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ===== WHAT-IF SIMULATOR ENDPOINTS =====

router.post('/what-if/:proposalId', async (req: Request, res: Response) => {
  try {
    const { proposalId } = req.params;
    const { mode, assumptions } = req.body;
    const result = await WhatIfSimulatorEngine.runSimulation(proposalId, mode, assumptions);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/what-if/:proposalId/scenarios', async (req: Request, res: Response) => {
  try {
    const { proposalId } = req.params;
    const scenarios = await WhatIfSimulatorEngine.getScenarios(proposalId);
    res.json({ proposalId, scenarios });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/what-if/:proposalId/toggle-report', async (req: Request, res: Response) => {
  try {
    const { proposalId } = req.params;
    const { scenarioName, include } = req.body;
    await WhatIfSimulatorEngine.toggleReportInclusion(proposalId, scenarioName, include);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/what-if/:proposalId/report-scenarios', async (req: Request, res: Response) => {
  try {
    const { proposalId } = req.params;
    const scenarios = await WhatIfSimulatorEngine.getScenariosForReport(proposalId);
    res.json({ proposalId, scenarios });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ===== BENCHMARK MAPPING ENDPOINTS =====

router.get('/benchmarks/select', async (req: Request, res: Response) => {
  try {
    const { goalType, riskProfile, horizonYears } = req.query;
    const benchmark = await GoalBenchmarkMapper.selectBenchmark(
      goalType as any,
      riskProfile as any,
      parseInt(horizonYears as string)
    );
    const explanation = GoalBenchmarkMapper.getBenchmarkExplanation(
      goalType as any,
      riskProfile as any,
      parseInt(horizonYears as string),
      benchmark
    );
    res.json({ benchmark, explanation });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/benchmarks/all', async (req: Request, res: Response) => {
  try {
    const mappings = await GoalBenchmarkMapper.getAllMappings();
    res.json({ mappings });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/benchmarks/override', async (req: Request, res: Response) => {
  try {
    const { goalType, riskProfile, horizonYearsMin, benchmarkCode, benchmarkName, rationale, overriddenBy } = req.body;
    await GoalBenchmarkMapper.overrideBenchmark(
      goalType,
      riskProfile,
      horizonYearsMin,
      benchmarkCode,
      benchmarkName,
      rationale,
      overriddenBy
    );
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/benchmarks/initialize', async (req: Request, res: Response) => {
  try {
    await GoalBenchmarkMapper.initializeDefaults();
    res.json({ success: true, message: 'Default benchmarks initialized' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ===== VERDICT ENDPOINTS =====

router.post('/verdicts/:proposalId', async (req: Request, res: Response) => {
  try {
    const { proposalId } = req.params;
    const assignment = req.body;
    const result = await ProposalVerdictNormalizer.assignVerdict(proposalId, assignment);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/verdicts/:proposalId/bulk', async (req: Request, res: Response) => {
  try {
    const { proposalId } = req.params;
    const { assignments } = req.body;
    const result = await ProposalVerdictNormalizer.bulkAssignVerdicts(proposalId, assignments);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/verdicts/:proposalId/validate', async (req: Request, res: Response) => {
  try {
    const { proposalId } = req.params;
    const validation = await ProposalVerdictNormalizer.validateProposalVerdicts(proposalId);
    res.json(validation);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/verdicts/:proposalId/summary', async (req: Request, res: Response) => {
  try {
    const { proposalId } = req.params;
    const summary = await ProposalVerdictNormalizer.getVerdictSummary(proposalId);
    res.json(summary);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/verdicts/:proposalId/block-check', async (req: Request, res: Response) => {
  try {
    const { proposalId } = req.params;
    const result = await ProposalVerdictNormalizer.blockIfIncomplete(proposalId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ===== SIP ATTRIBUTION ENDPOINTS =====

router.post('/sips/:proposalId', async (req: Request, res: Response) => {
  try {
    const { proposalId } = req.params;
    const recommendation = req.body;
    const result = await ProposalSipAttribution.createSipRecommendation(proposalId, recommendation);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/sips/:proposalId/bulk', async (req: Request, res: Response) => {
  try {
    const { proposalId } = req.params;
    const { recommendations } = req.body;
    const result = await ProposalSipAttribution.bulkCreateSipRecommendations(proposalId, recommendations);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/sips/:proposalId/convert-lumpsum', async (req: Request, res: Response) => {
  try {
    const { proposalId } = req.params;
    const { instrumentName, lumpsumAmount, sipDurationMonths } = req.body;
    const result = await ProposalSipAttribution.convertLumpsumToSip(
      proposalId,
      instrumentName,
      lumpsumAmount,
      sipDurationMonths
    );
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/sips/:proposalId/summary', async (req: Request, res: Response) => {
  try {
    const { proposalId } = req.params;
    const summary = await ProposalSipAttribution.getSipSummary(proposalId);
    res.json(summary);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/sips/:proposalId/:instrumentName', async (req: Request, res: Response) => {
  try {
    const { proposalId, instrumentName } = req.params;
    const result = await ProposalSipAttribution.deleteSipRecommendation(proposalId, instrumentName);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ===== REPORT SECTIONS ENDPOINTS =====

router.get('/report-sections/:proposalId', async (req: Request, res: Response) => {
  try {
    const { proposalId } = req.params;
    const sections = await ReportDependencyResolver.resolveAllSections(proposalId);
    res.json({ proposalId, sections });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/report-sections/:proposalId/toggle', async (req: Request, res: Response) => {
  try {
    const { proposalId } = req.params;
    const { sectionCode, enabled, byAgent } = req.body;
    const result = await ReportDependencyResolver.toggleSection(proposalId, sectionCode, enabled, byAgent);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/report-sections/:proposalId/enabled', async (req: Request, res: Response) => {
  try {
    const { proposalId } = req.params;
    const sections = await ReportDependencyResolver.getEnabledSections(proposalId);
    res.json({ proposalId, enabledSections: sections });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/report-sections/:proposalId/auto-select', async (req: Request, res: Response) => {
  try {
    const { proposalId } = req.params;
    const enabledSections = await ReportDependencyResolver.autoSelectSections(proposalId);
    res.json({ proposalId, enabledSections });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ===== LABEL REGISTRY ENDPOINTS =====

router.get('/labels', async (req: Request, res: Response) => {
  try {
    const labels = ReportLabelRegistry.getAllLabels();
    res.json({ labels });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/labels/:key', async (req: Request, res: Response) => {
  try {
    const { key } = req.params;
    const entry = ReportLabelRegistry.getLabelEntry(key);
    if (entry) {
      res.json(entry);
    } else {
      res.status(404).json({ error: 'Label not found' });
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/labels/correct', async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    const corrected = ReportLabelRegistry.correctTypo(text);
    res.json({ original: text, corrected });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/labels/category/:prefix', async (req: Request, res: Response) => {
  try {
    const { prefix } = req.params;
    let labels;
    switch (prefix) {
      case 'goal':
        labels = ReportLabelRegistry.getGoalLabels();
        break;
      case 'risk':
        labels = ReportLabelRegistry.getRiskProfileLabels();
        break;
      case 'phase':
        labels = ReportLabelRegistry.getPhaseLabels();
        break;
      case 'scenario':
        labels = ReportLabelRegistry.getScenarioLabels();
        break;
      case 'verdict':
        labels = ReportLabelRegistry.getVerdictLabels();
        break;
      default:
        labels = ReportLabelRegistry.getLabelsForCategory(prefix);
    }
    res.json({ labels });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
