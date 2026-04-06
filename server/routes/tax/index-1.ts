import { Express } from 'express';
import { taxOrchestrator } from '../../services/tax-orchestrator';
import { sandboxITRService } from '../../sandbox-itr-service';
import { sandboxTDSService } from '../../sandbox-tds-service';

export function registerTaxPart1Routes(app: Express): void {
  // ============ UNIFIED TAX SMART FILING API ROUTES ============
  
  app.post("/api/tax/session", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { panNumber, assessmentYear } = req.body;
      
      if (!panNumber || !assessmentYear) {
        return res.status(400).json({ error: "PAN number and assessment year are required" });
      }

      const existingSession = await taxOrchestrator.getSessionSummary(`${req.user.id}-${panNumber}-${assessmentYear}`);
      if (existingSession.session) {
        return res.json(existingSession.session);
      }

      const session = await taxOrchestrator.createSession({
        userId: req.user!.id,
        panNumber,
        assessmentYear,
        financialYear: `${parseInt(assessmentYear.split('-')[0]) - 1}-${parseInt(assessmentYear.split('-')[1]) - 1}`
      });

      res.status(201).json(session);
    } catch (error) {
      console.error("Error creating tax session:", error);
      res.status(500).json({ error: "Failed to create tax session" });
    }
  });

  app.get("/api/tax/session/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const summary = await taxOrchestrator.getSessionSummary(sessionId);
      
      if (!summary.session) {
        return res.status(404).json({ error: "Tax session not found" });
      }
      
      res.json(summary);
    } catch (error) {
      console.error("Error fetching tax session:", error);
      res.status(500).json({ error: "Failed to fetch tax session" });
    }
  });

  app.get("/api/tax/sessions", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }
      res.json([]);
    } catch (error) {
      console.error("Error fetching tax sessions:", error);
      res.status(500).json({ error: "Failed to fetch tax sessions" });
    }
  });

  app.post("/api/tax/session/:sessionId/initialize", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const dataSources = await taxOrchestrator.initializeDataSources(sessionId);
      await taxOrchestrator.updateSessionProgress(sessionId, 1, "aggregating");
      
      res.json({ dataSources, message: "Data sources initialized successfully" });
    } catch (error) {
      console.error("Error initializing data sources:", error);
      res.status(500).json({ error: "Failed to initialize data sources" });
    }
  });

  app.post("/api/tax/session/:sessionId/sync-all", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const result = await taxOrchestrator.aggregateData(sessionId);
      
      if (result.success) {
        await taxOrchestrator.updateSessionProgress(sessionId, 2, "prefilled");
      }
      
      res.json(result);
    } catch (error) {
      console.error("Error syncing data sources:", error);
      res.status(500).json({ error: "Failed to sync data sources" });
    }
  });

  app.post("/api/tax/session/:sessionId/validate", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const issues = await taxOrchestrator.validateSessionData(sessionId);
      await taxOrchestrator.updateSessionProgress(sessionId, 3, "validated");
      
      res.json({ 
        issues,
        summary: {
          totalIssues: issues.length,
          errors: issues.filter(i => i.severity === 'error').length,
          warnings: issues.filter(i => i.severity === 'warning').length,
          suggestions: issues.filter(i => i.severity === 'suggestion').length
        }
      });
    } catch (error) {
      console.error("Error validating session:", error);
      res.status(500).json({ error: "Failed to validate session" });
    }
  });

  app.post("/api/tax/session/:sessionId/optimize", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const suggestions = await taxOrchestrator.generateOptimizationSuggestions(sessionId);
      await taxOrchestrator.updateSessionProgress(sessionId, 4, "optimized");
      
      res.json({ suggestions });
    } catch (error) {
      console.error("Error generating suggestions:", error);
      res.status(500).json({ error: "Failed to generate optimization suggestions" });
    }
  });

  app.post("/api/tax/session/:sessionId/generate-itr", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const result = await taxOrchestrator.generateItrJson(sessionId);
      await taxOrchestrator.updateSessionProgress(sessionId, 5, "generated");
      
      res.json(result);
    } catch (error) {
      console.error("Error generating ITR:", error);
      res.status(500).json({ error: "Failed to generate ITR JSON" });
    }
  });

  app.post("/api/tax/session/:sessionId/file", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { itrJson, verificationMethod } = req.body;
      
      const filingRecord = await taxOrchestrator.submitFiling(sessionId, itrJson, verificationMethod);
      await taxOrchestrator.updateSessionProgress(sessionId, 6, "filed");
      
      res.json(filingRecord);
    } catch (error) {
      console.error("Error filing ITR:", error);
      res.status(500).json({ error: "Failed to file ITR" });
    }
  });

  app.get("/api/tax/session/:sessionId/summary", async (req, res) => {
    try {
      const { sessionId } = req.params;
      const summary = await taxOrchestrator.getSessionSummary(sessionId);
      res.json(summary);
    } catch (error) {
      console.error("Error fetching summary:", error);
      res.status(500).json({ error: "Failed to fetch session summary" });
    }
  });

  app.get("/api/tax/smart-defaults", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const defaults = taxOrchestrator.getSmartDefaults();
      res.json(defaults);
    } catch (error) {
      console.error("Error fetching smart defaults:", error);
      res.status(500).json({ error: "Failed to fetch smart defaults" });
    }
  });

  app.post("/api/tax/suggestion/:suggestionId/respond", async (req, res) => {
    try {
      const { suggestionId } = req.params;
      const { status, userResponse } = req.body;
      
      if (!['accepted', 'rejected', 'implemented'].includes(status)) {
        return res.status(400).json({ error: "Invalid response status" });
      }

      res.json({ 
        success: true, 
        message: `Suggestion ${status} successfully`,
        suggestionId,
        status,
        userResponse 
      });
    } catch (error) {
      console.error("Error responding to suggestion:", error);
      res.status(500).json({ error: "Failed to respond to suggestion" });
    }
  });

  // ============ SANDBOX.CO.IN ITR API ROUTES ============
  
  app.post("/api/sandbox-itr/calculate-tax", async (req, res) => {
    try {
      const result = await sandboxITRService.calculateTax(req.body);
      res.json(result);
    } catch (error) {
      console.error("Tax calculation error:", error);
      res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : "Tax calculation failed" 
      });
    }
  });

  app.post("/api/sandbox-itr/calculate-wizard", async (req, res) => {
    try {
      const result = await sandboxITRService.calculateTaxFromWizard(req.body);
      res.json(result);
    } catch (error) {
      console.error("Wizard tax calculation error:", error);
      res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : "Wizard tax calculation failed" 
      });
    }
  });

  app.post("/api/sandbox-itr/prepare", async (req, res) => {
    try {
      const result = await sandboxITRService.prepareITR(req.body);
      res.json(result);
    } catch (error) {
      console.error("ITR preparation error:", error);
      res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : "ITR preparation failed" 
      });
    }
  });

  app.post("/api/sandbox-itr/file", async (req, res) => {
    try {
      const result = await sandboxITRService.fileITR(req.body);
      res.json(result);
    } catch (error) {
      console.error("ITR filing error:", error);
      res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : "ITR filing failed" 
      });
    }
  });

  app.get("/api/sandbox-itr/status/:acknowledgmentNumber", async (req, res) => {
    try {
      const { acknowledgmentNumber } = req.params;
      const result = await sandboxITRService.getITRStatus(acknowledgmentNumber);
      res.json(result);
    } catch (error) {
      console.error("ITR status error:", error);
      res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : "Status check failed" 
      });
    }
  });

  app.get("/api/sandbox-itr/form-26as/:pan/:assessmentYear", async (req, res) => {
    try {
      const { pan, assessmentYear } = req.params;
      const result = await sandboxITRService.getForm26AS(pan, assessmentYear);
      res.json(result);
    } catch (error) {
      console.error("Form 26AS error:", error);
      res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : "Form 26AS fetch failed" 
      });
    }
  });

  app.get("/api/sandbox-itr/ais/:pan/:assessmentYear", async (req, res) => {
    try {
      const { pan, assessmentYear } = req.params;
      const result = await sandboxITRService.getAIS(pan, assessmentYear);
      res.json(result);
    } catch (error) {
      console.error("AIS error:", error);
      res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : "AIS fetch failed" 
      });
    }
  });

  app.get("/api/sandbox-itr/itr-v/:acknowledgmentNumber", async (req, res) => {
    try {
      const { acknowledgmentNumber } = req.params;
      const result = await sandboxITRService.downloadITRV(acknowledgmentNumber);
      res.json(result);
    } catch (error) {
      console.error("ITR-V download error:", error);
      res.status(500).json({ 
        success: false, 
        message: error instanceof Error ? error.message : "ITR-V download failed" 
      });
    }
  });

  app.post("/api/sandbox-itr/suggest-form", async (req, res) => {
    try {
      const { incomeDetails, entityType } = req.body;
      if (!incomeDetails) {
        return res.status(400).json({ 
          success: false, 
          message: "Income details are required" 
        });
      }
      const suggestion = sandboxITRService.getSuitableITRForm(incomeDetails, entityType || 'individual');
      res.json({ 
        success: true, 
        ...suggestion 
      });
    } catch (error) {
      console.error("Form suggestion error:", error);
      res.status(500).json({ 
        success: false, 
        message: "Form suggestion failed" 
      });
    }
  });

  app.get("/api/sandbox-itr/entity-types", async (req, res) => {
    try {
      const entityTypes = {
        individual: { name: 'Individual', description: 'Resident/Non-resident individual', applicableForms: ['ITR-1', 'ITR-2', 'ITR-3', 'ITR-4'] },
        huf: { name: 'Hindu Undivided Family', description: 'HUF entities', applicableForms: ['ITR-2', 'ITR-3', 'ITR-4'] },
        partnership: { name: 'Partnership Firm', description: 'Partnership firms and LLPs', applicableForms: ['ITR-5'] },
        company: { name: 'Company', description: 'Private/Public limited companies', applicableForms: ['ITR-6'] },
        aop_boi: { name: 'AOP/BOI', description: 'Association of Persons / Body of Individuals', applicableForms: ['ITR-5'] },
        trust: { name: 'Trust/Society', description: 'Charitable trusts, educational institutions', applicableForms: ['ITR-7'] },
        local_authority: { name: 'Local Authority', description: 'Municipal corporations, panchayats', applicableForms: ['ITR-7'] },
        artificial_juridical: { name: 'Artificial Juridical Person', description: 'Statutory corporations', applicableForms: ['ITR-7'] },
        political_party: { name: 'Political Party', description: 'Registered political parties', applicableForms: ['ITR-7'] },
        news_agency: { name: 'News Agency', description: 'Press Trust of India, United News of India, etc.', applicableForms: ['ITR-7'] }
      };
      
      res.json({ 
        success: true, 
        entityTypes,
        totalTypes: Object.keys(entityTypes).length,
        message: "Entity types retrieved successfully"
      });
    } catch (error) {
      console.error("Entity types error:", error);
      res.status(500).json({ success: false, message: "Failed to retrieve entity types" });
    }
  });

  app.get("/api/sandbox-itr/status", async (req, res) => {
    try {
      res.json({ 
        success: true, 
        configured: sandboxITRService.isConfigured(),
        message: sandboxITRService.isConfigured() 
          ? "Sandbox.co.in ITR service is configured and ready"
          : "Sandbox.co.in ITR service is using mock data (API credentials not configured)"
      });
    } catch (error) {
      res.status(500).json({ success: false, message: "Status check failed" });
    }
  });

  app.get("/api/sandbox-itr/test-data", async (_req, res) => {
    try {
      res.json({
        success: true,
        testPANs: sandboxITRService.getTestPANs(),
        eriCredentials: sandboxITRService.getERITestCredentials(),
        message: 'Sandbox.co.in ITR test data for ITR-1 through ITR-7',
      });
    } catch (error) {
      res.status(500).json({ success: false, message: "Failed to retrieve test data" });
    }
  });

  app.post("/api/sandbox-itr/eri/login", async (req, res) => {
    try {
      const { userId, password } = req.body;
      const result = await sandboxITRService.eriLogin(userId, password);
      res.json(result);
    } catch (error) {
      console.error("ERI login error:", error);
      res.status(500).json({ success: false, message: error instanceof Error ? error.message : "ERI login failed" });
    }
  });

  // ============ SANDBOX.CO.IN TDS API ROUTES ============

}
