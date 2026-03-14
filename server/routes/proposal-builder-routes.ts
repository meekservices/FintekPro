import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { ProposalFlowGatekeeper, createPhaseValidationMiddleware } from '../services/proposal-flow-gatekeeper';
import { WhatIfSimulatorEngine } from '../services/proposal-whatif-engine';
import { GoalBenchmarkMapper } from '../services/goal-benchmark-mapper';
import { ProposalVerdictNormalizer } from '../services/proposal-verdict-normalizer';
import { ProposalSipAttribution } from '../services/proposal-sip-attribution';
import { ReportDependencyResolver } from '../services/report-dependency-resolver';
import { ReportLabelRegistry } from '../services/report-label-registry';
import { generateRegulatorGradePdf, type ProposalPdfConfig } from '../services/reports/regulator-grade-pdf-renderer';
import { proposalAuditService } from '../services/proposal-audit-service';

const router = Router();

GoalBenchmarkMapper.initializeDefaults().catch(e =>
  console.warn('[ProposalBuilder] Benchmark defaults init warning:', e?.message)
);

const PdfConfigSchema = z.object({
  proposalId: z.string().optional(),
  version: z.string(),
  client: z.object({
    name: z.string(),
    pan: z.string().optional(),
    email: z.string().optional(),
    phone: z.string().optional(),
  }),
  advisor: z.object({
    name: z.string(),
    arnId: z.string().optional(),
    riaId: z.string().optional(),
    email: z.string().optional(),
  }),
  investmentGoals: z.object({
    primaryGoal: z.string(),
    investmentHorizon: z.string(),
    targetAmount: z.number(),
    monthlyContribution: z.number(),
  }),
  riskProfile: z.object({
    score: z.number(),
    category: z.enum(['conservative', 'moderate', 'aggressive', 'very_aggressive']),
    tolerance: z.string(),
    version: z.string().optional(),
  }),
  proposedAllocation: z.object({
    equity: z.number(),
    debt: z.number(),
    gold: z.number(),
    realestate: z.number(),
    cash: z.number(),
    totalValue: z.number(),
  }),
  sections: z.object({
    coverPage: z.boolean(),
    tableOfContents: z.boolean(),
    executiveSummary: z.boolean(),
    portfolioOverview: z.boolean(),
    productRecommendations: z.boolean(),
    capitalGainsSummary: z.boolean(),
    exitLoadSummary: z.boolean(),
    taxImpactSummary: z.boolean(),
    rebalancingSipRecommendations: z.boolean(),
    portfolioHealthScore: z.boolean(),
    expenseRatioAnalysis: z.boolean(),
    riskHeatMap: z.boolean(),
    benchmarkComparison: z.boolean(),
    whatIfScenarios: z.boolean(),
    dividendProjection: z.boolean(),
    priorityRecommendations: z.boolean(),
    portfolioGrowthProjection: z.boolean(),
    mandatoryDisclaimers: z.boolean(),
    advisorDeclaration: z.boolean(),
  }),
  settings: z.object({
    orientation: z.enum(['portrait', 'landscape']),
  }),
  generatedBy: z.string().optional(),
  generatedByRole: z.enum(['agent', 'admin', 'system']).optional(),
  downloadedBy: z.string().optional(),
  existingAllocation: z.object({
    equity: z.number(),
    debt: z.number(),
    gold: z.number(),
    realestate: z.number(),
    cash: z.number(),
    totalValue: z.number(),
  }).optional(),
  existingHoldings: z.array(z.any()).optional(),
  verdicts: z.array(z.any()).optional(),
  capitalGains: z.any().optional(),
  exitLoads: z.array(z.any()).optional(),
  taxImpact: z.any().optional(),
  sipRecommendations: z.array(z.any()).optional(),
  portfolioHealth: z.any().optional(),
  expenseAnalysis: z.any().optional(),
  riskHeatMap: z.any().optional(),
  benchmarkComparison: z.any().optional(),
  whatIfScenarios: z.array(z.any()).optional(),
  dividendProjection: z.any().optional(),
  priorityRecommendations: z.array(z.any()).optional(),
  growthProjection: z.any().optional(),
});

const OverrideLogSchema = z.object({
  eventType: z.string(),
  payloadBefore: z.record(z.any()).optional(),
  payloadAfter: z.record(z.any()).optional(),
  actorId: z.string(),
  actorRole: z.enum(['agent', 'admin', 'compliance']),
  reason: z.string().min(1, 'Override reason is required'),
  approvedBy: z.string().optional(),
});

const BenchmarkOverrideSchema = z.object({
  before: z.record(z.any()),
  after: z.record(z.any()),
  actorId: z.string(),
  reason: z.string().min(1, 'Override reason is required'),
});

const SectionToggleSchema = z.object({
  sectionCode: z.string(),
  before: z.boolean(),
  after: z.boolean(),
  actorId: z.string(),
  actorRole: z.enum(['agent', 'admin']),
  reason: z.string().optional(),
});

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

// ===== PDF GENERATION ENDPOINTS =====

router.post('/pdf/:proposalId/generate', async (req: Request, res: Response) => {
  try {
    const { proposalId } = req.params;
    
    // Validate request body using Zod schema
    const parseResult = PdfConfigSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ 
        error: 'Invalid PDF configuration',
        details: parseResult.error.flatten().fieldErrors
      });
    }
    
    const validatedConfig = parseResult.data;
    const config: ProposalPdfConfig = {
      ...validatedConfig,
      proposalId,
    } as ProposalPdfConfig;
    
    // Generate PDF
    const result = await generateRegulatorGradePdf(config);
    
    // Record PDF metadata in audit service
    await proposalAuditService.recordPdfMetadata(
      proposalId,
      result,
      validatedConfig.generatedBy || 'system',
      validatedConfig.generatedByRole || 'agent',
      config.client?.pan,
      config.riskProfile?.version,
      config.benchmarkComparison?.benchmarkCode
    );
    
    // Log PDF generation audit event
    await proposalAuditService.logPdfGenerated(
      proposalId,
      result.version,
      result.hash,
      result.sectionsIncluded,
      validatedConfig.generatedBy || 'system'
    );
    
    res.json({
      success: true,
      proposalId,
      version: result.version,
      hash: result.hash,
      totalPages: result.totalPages,
      sectionsIncluded: result.sectionsIncluded,
      metadata: result.metadata,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/pdf/:proposalId/download', async (req: Request, res: Response) => {
  try {
    const { proposalId } = req.params;
    
    // Validate request body using Zod schema
    const parseResult = PdfConfigSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ 
        error: 'Invalid PDF configuration',
        details: parseResult.error.flatten().fieldErrors
      });
    }
    
    const validatedConfig = parseResult.data;
    const config: ProposalPdfConfig = {
      ...validatedConfig,
      proposalId,
    } as ProposalPdfConfig;
    
    // Generate PDF
    const result = await generateRegulatorGradePdf(config);
    
    // Record download audit event
    const actorId = validatedConfig.downloadedBy || 'unknown';
    await proposalAuditService.logPdfDownloaded(
      proposalId,
      result.version,
      result.hash,
      actorId,
      req.ip
    );
    
    // Increment download count
    await proposalAuditService.recordPdfDownload(proposalId, result.hash);
    
    // Set response headers for PDF download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="proposal_${proposalId}_${result.version}.pdf"`);
    res.setHeader('X-PDF-Hash', result.hash);
    res.setHeader('X-PDF-Version', result.version);
    res.setHeader('X-PDF-Pages', result.totalPages.toString());
    
    res.send(result.pdfBuffer);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/pdf/:proposalId/history', async (req: Request, res: Response) => {
  try {
    const { proposalId } = req.params;
    const history = await proposalAuditService.getPdfMetadataHistory(proposalId);
    res.json({ proposalId, history });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/pdf/:proposalId/verify', async (req: Request, res: Response) => {
  try {
    const { proposalId } = req.params;
    const { hash } = req.body;
    
    if (!hash) {
      return res.status(400).json({ error: 'hash is required' });
    }
    
    const isValid = await proposalAuditService.verifyPdfHash(proposalId, hash);
    res.json({ proposalId, hash, verified: isValid });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ===== AUDIT TRAIL ENDPOINTS =====

router.get('/audit/:proposalId', async (req: Request, res: Response) => {
  try {
    const { proposalId } = req.params;
    const auditTrail = await proposalAuditService.getAuditTrail(proposalId);
    res.json({ proposalId, auditTrail });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/audit/:proposalId/overrides', async (req: Request, res: Response) => {
  try {
    const { proposalId } = req.params;
    const overrides = await proposalAuditService.getOverrideEvents(proposalId);
    res.json({ proposalId, overrides });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/audit/:proposalId/chain-integrity', async (req: Request, res: Response) => {
  try {
    const { proposalId } = req.params;
    const integrity = await proposalAuditService.verifyChainIntegrity(proposalId);
    res.json({ proposalId, ...integrity });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/audit/:proposalId/export', async (req: Request, res: Response) => {
  try {
    const { proposalId } = req.params;
    const { format } = req.query;
    
    const bundle = await proposalAuditService.exportAuditBundle(proposalId);
    
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="audit_${proposalId}.csv"`);
      res.send(bundle.csv);
    } else {
      res.json(bundle.json);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/audit/retention/stats', async (req: Request, res: Response) => {
  try {
    const stats = await proposalAuditService.getRetentionStats();
    res.json(stats);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/audit/retention/archive', async (req: Request, res: Response) => {
  try {
    const archivedCount = await proposalAuditService.archiveExpiredEvents();
    res.json({ success: true, archivedCount });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ===== ROLE-BASED OVERRIDE LOGGING ENDPOINTS =====

router.post('/audit/:proposalId/log-override', async (req: Request, res: Response) => {
  try {
    const { proposalId } = req.params;
    
    // Validate request body using Zod schema
    const parseResult = OverrideLogSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ 
        error: 'Invalid override log request',
        details: parseResult.error.flatten().fieldErrors
      });
    }
    
    const validated = parseResult.data;
    
    const event = await proposalAuditService.logEvent({
      proposalId,
      eventType: validated.eventType as any,
      eventAction: 'OVERRIDDEN',
      actorId: validated.actorId,
      actorRole: validated.actorRole,
      payloadBefore: validated.payloadBefore,
      payloadAfter: validated.payloadAfter,
      isOverride: true,
      overrideReason: validated.reason,
      overrideApprovedBy: validated.approvedBy,
    });
    
    res.json({ success: true, eventId: event.id, checksum: event.checksum });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/audit/:proposalId/log-benchmark-override', async (req: Request, res: Response) => {
  try {
    const { proposalId } = req.params;
    
    // Validate request body using Zod schema
    const parseResult = BenchmarkOverrideSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ 
        error: 'Invalid benchmark override request',
        details: parseResult.error.flatten().fieldErrors
      });
    }
    
    const validated = parseResult.data;
    
    const event = await proposalAuditService.logBenchmarkOverridden(
      proposalId, 
      validated.before, 
      validated.after, 
      validated.actorId, 
      validated.reason
    );
    res.json({ success: true, eventId: event.id, checksum: event.checksum });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/audit/:proposalId/log-section-toggle', async (req: Request, res: Response) => {
  try {
    const { proposalId } = req.params;
    
    // Validate request body using Zod schema
    const parseResult = SectionToggleSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ 
        error: 'Invalid section toggle request',
        details: parseResult.error.flatten().fieldErrors
      });
    }
    
    const validated = parseResult.data;
    
    const event = await proposalAuditService.logReportSectionToggled(
      proposalId,
      validated.sectionCode,
      validated.before,
      validated.after,
      validated.actorId,
      validated.actorRole,
      validated.reason
    );
    
    res.json({ success: true, eventId: event.id, checksum: event.checksum });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
