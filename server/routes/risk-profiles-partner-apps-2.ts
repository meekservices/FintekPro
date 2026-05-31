// @ts-nocheck
import { Express } from 'express';
import { storage } from '../storage';
import { db } from '../db';
import { eq, and, or } from 'drizzle-orm';
import { z } from 'zod';
import { requireAuth } from '../middleware/roleMiddleware';
import { requireAdmin } from '../middleware/roleMiddleware';
import { unifiedOCRService } from '../services/unified-ocr-service';
import { ObjectStorageService } from '../objectStorage';
import { providerRegistry } from '../partner-application-adapters';
import { insertPartnerApplicationSchema, insertPartnerApplicationDocumentSchema } from '@shared/schema';
import { buildRequireOwnPortfolio } from './portfolio-core';

export function registerRiskProfilesPartnerAppPart2Routes(app: Express): void {
  const requireOwnPortfolio = buildRequireOwnPortfolio(storage);
app.post("/api/ocr/form26as", async (req, res) => {
  try {
    const { fileData, fileName } = req.body;
    
    if (!fileData) {
      return res.status(400).json({ 
        success: false, 
        error: "File data is required (base64 encoded PDF)" 
      });
    }

    // Convert base64 to buffer
    const fileBuffer = Buffer.from(fileData, 'base64');
    const result = await sandboxITRService.parseForm26AS(fileBuffer, fileName || 'form26as.pdf');
    
    res.json(result);
  } catch (error) {
    console.error("Form 26AS OCR error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Form 26AS OCR parsing failed",
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Parse any tax document (auto-detect type)
app.post("/api/ocr/parse-document", async (req, res) => {
  try {
    const { fileData, fileName, documentType } = req.body;
    
    if (!fileData) {
      return res.status(400).json({ 
        success: false, 
        error: "File data is required (base64 encoded PDF)" 
      });
    }

    const fileBuffer = Buffer.from(fileData, 'base64');
    let result;

    // Route to appropriate OCR based on document type
    switch (documentType?.toLowerCase()) {
      case 'form16':
      case 'form_16':
      case 'form-16':
        result = await sandboxITRService.parseForm16(fileBuffer, fileName || 'form16.pdf');
        break;
      case 'form26as':
      case 'form_26as':
      case 'form-26as':
      case '26as':
        result = await sandboxITRService.parseForm26AS(fileBuffer, fileName || 'form26as.pdf');
        break;
      default:
        // Try to auto-detect based on filename
        const lowerFileName = (fileName || '').toLowerCase();
        if (lowerFileName.includes('form16') || lowerFileName.includes('form-16') || lowerFileName.includes('form_16')) {
          result = await sandboxITRService.parseForm16(fileBuffer, fileName);
        } else if (lowerFileName.includes('26as') || lowerFileName.includes('form26')) {
          result = await sandboxITRService.parseForm26AS(fileBuffer, fileName);
        } else {
          // Default to Form 16 if cannot determine
          result = await sandboxITRService.parseForm16(fileBuffer, fileName || 'document.pdf');
        }
    }
    
    res.json(result);
  } catch (error) {
    console.error("Document OCR error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Document OCR parsing failed",
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============ END SANDBOX.CO.IN OCR API ROUTES ============



// ============ TAX DATA CENTER API ROUTES ============

// Get data sources status
app.get("/api/tax-data/sources/:year", async (req, res) => {
  try {
    const { year } = req.params;
    const { pan } = req.query;
    
    if (!pan) {
      return res.status(400).json({ error: "PAN number is required" });
    }
    
    // Mock data sources status - in production, check actual connections
    const dataSources = [
      {
        id: 'form26as',
        name: 'Form 26AS',
        status: 'connected',
        lastSync: '2024-03-15T10:30:00Z',
        recordCount: 15,
        dataTypes: ['TDS', 'TCS', 'Advance Tax']
      },
      {
        id: 'ais',
        name: 'Annual Information Statement',
        status: 'connected',
        lastSync: '2024-03-15T09:45:00Z',
        recordCount: 42,
        dataTypes: ['Salary', 'Interest', 'Dividends', 'Capital Gains']
      },
      {
        id: 'cams',
        name: 'CAMS Mutual Funds',
        status: 'connected',
        lastSync: '2024-03-14T18:20:00Z',
        recordCount: 28,
        dataTypes: ['SIP', 'Redemptions', 'Dividends']
      },
      {
        id: 'kfintech',
        name: 'KFintech Mutual Funds',
        status: 'pending',
        lastSync: null,
        recordCount: 0,
        dataTypes: ['SIP', 'Redemptions', 'Dividends']
      },
      {
        id: 'nsdl',
        name: 'NSDL Securities',
        status: 'connected',
        lastSync: '2024-03-15T08:15:00Z',
        recordCount: 36,
        dataTypes: ['Trading', 'Dividends', 'Bonus', 'Rights']
      },
      {
        id: 'cdsl',
        name: 'CDSL Securities',
        status: 'error',
        lastSync: '2024-03-10T14:30:00Z',
        recordCount: 12,
        dataTypes: ['Trading', 'Dividends']
      },
      {
        id: 'banks',
        name: 'Bank Statements',
        status: 'not_connected',
        lastSync: null,
        recordCount: 0,
        dataTypes: ['Interest', 'FD Maturity', 'Charges']
      }
    ];
    
    res.json(dataSources);
  } catch (error) {
    console.error("Error fetching tax data sources:", error);
    res.status(500).json({ error: "Failed to fetch data sources" });
  }
});

// Get tax summary
app.get("/api/tax-data/summary/:year", async (req, res) => {
  try {
    const { year } = req.params;
    const { pan } = req.query;
    
    if (!pan) {
      return res.status(400).json({ error: "PAN number is required" });
    }
    
    // Mock aggregated tax data - in production, aggregate from all sources
    const taxSummary = {
      totalIncome: 1250000,
      totalTDS: 125000,
      salaryIncome: 800000,
      capitalGains: 150000,
      dividendIncome: 45000,
      interestIncome: 255000,
      otherIncome: 0,
      deductions: 150000,
      exemptions: 50000,
      netTaxableIncome: 1050000,
      taxLiability: 78750,
      refundDue: 46250
    };
    
    res.json(taxSummary);
  } catch (error) {
    console.error("Error fetching tax summary:", error);
    res.status(500).json({ error: "Failed to fetch tax summary" });
  }
});

// Sync data from specific source
app.post("/api/tax-data/sync/:sourceId", async (req, res) => {
  try {
    const { sourceId } = req.params;
    const { year, pan } = req.body;
    
    if (!pan || !year) {
      return res.status(400).json({ error: "PAN and year are required" });
    }
    
    // Mock sync process - in production, connect to actual APIs
    const syncResult = {
      sourceId,
      status: 'completed',
      recordsFound: Math.floor(Math.random() * 50) + 10,
      lastSync: new Date().toISOString(),
      dataTypes: ['TDS', 'Interest', 'Dividends'],
      errors: []
    };
    
    // Simulate sync delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    res.json({
      success: true,
      message: `Successfully synced data from ${sourceId}`,
      data: syncResult
    });
  } catch (error) {
    console.error("Error syncing tax data:", error);
    res.status(500).json({ error: "Failed to sync data source" });
  }
});

// Generate comprehensive tax report
app.post("/api/tax-data/generate-report", async (req, res) => {
  try {
    const { year, format, pan } = req.body;
    
    if (!pan || !year || !format) {
      return res.status(400).json({ error: "PAN, year, and format are required" });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `TaxReport_${year}_${pan}_${timestamp}.${format}`;
    
    // Mock file generation - in production, generate actual reports
    const reportData = {
      success: true,
      message: 'Report generated successfully',
      downloadUrl: `/api/tax-data/download/${filename}`,
      filename: filename,
      generatedAt: new Date().toISOString(),
      recordsIncluded: 127,
      sources: ['Form 26AS', 'AIS', 'CAMS', 'NSDL']
    };
    
    res.json(reportData);
  } catch (error) {
    console.error("Error generating tax report:", error);
    res.status(500).json({ error: "Failed to generate tax report" });
  }
});

// Download tax report
app.get("/api/tax-data/download/:filename", async (req, res) => {
  try {
    const { filename } = req.params;
    
    const fileExtension = filename.split('.').pop()?.toLowerCase();
    let contentType = 'application/octet-stream';
    
    switch (fileExtension) {
      case 'pdf':
        contentType = 'application/pdf';
        break;
      case 'xlsx':
      case 'xls':
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        break;
      case 'json':
        contentType = 'application/json';
        break;
      case 'csv':
        contentType = 'text/csv';
        break;
    }
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Mock file content - in production, generate actual file
    const mockContent = `Mock ${fileExtension?.toUpperCase()} content for tax report ${filename}`;
    res.send(mockContent);
  } catch (error) {
    console.error("Error downloading tax report:", error);
    res.status(500).json({ error: "Failed to download tax report" });
  }
});

// Get detailed source data
app.get("/api/tax-data/source/:sourceId", async (req, res) => {
  try {
    const { sourceId } = req.params;
    const { year, pan } = req.query;
    
    if (!pan || !year) {
      return res.status(400).json({ error: "PAN and year are required" });
    }
    
    // Mock detailed source data
    const sourceData = {
      sourceId,
      sourceName: sourceId.toUpperCase(),
      year,
      pan,
      records: [
        {
          id: '1',
          date: '2024-01-15',
          description: 'Salary TDS - Employer ABC Ltd',
          amount: 15000,
          type: 'TDS',
          category: 'Salary'
        },
        {
          id: '2',
          date: '2024-02-28',
          description: 'Bank Interest - XYZ Bank',
          amount: 5000,
          type: 'Interest',
          category: 'Bank Interest'
        }
      ],
      totalAmount: 20000,
      recordCount: 2,
      lastUpdated: new Date().toISOString()
    };
    
    res.json(sourceData);
  } catch (error) {
    console.error("Error fetching source data:", error);
    res.status(500).json({ error: "Failed to fetch source data" });
  }
});

// Export data for external filing
app.post("/api/tax-data/export", async (req, res) => {
  try {
    const { year, pan, platform, format } = req.body;
    
    if (!pan || !year || !platform) {
      return res.status(400).json({ error: "PAN, year, and platform are required" });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${platform}_Export_${year}_${pan}_${timestamp}.${format || 'json'}`;
    
    // Mock export data formatted for specific platforms
    const exportData = {
      success: true,
      message: `Data exported for ${platform}`,
      downloadUrl: `/api/tax-data/download-export/${filename}`,
      filename: filename,
      platform: platform,
      compatibleWith: ['ClearTax', 'Income Tax Portal', 'CA Software'],
      instructionsUrl: `/api/tax-data/filing-guide/${platform}`
    };
    
    res.json(exportData);
  } catch (error) {
    console.error("Error exporting tax data:", error);
    res.status(500).json({ error: "Failed to export tax data" });
  }
});

// Get filing guide for platform
app.get("/api/tax-data/filing-guide/:platform", async (req, res) => {
  try {
    const { platform } = req.params;
    
    const guides = {
      'cleartax': {
        title: 'Filing with ClearTax',
        steps: [
          'Download the exported JSON file',
          'Log in to your ClearTax account',
          'Go to Import Data section',
          'Upload the JSON file',
          'Review imported data',
          'Complete your ITR filing'
        ],
        videoUrl: 'https://example.com/cleartax-guide',
        supportUrl: 'https://cleartax.in/support'
      },
      'incometax': {
        title: 'Filing with Income Tax Portal',
        steps: [
          'Download the Excel export',
          'Log in to incometaxindiaefiling.gov.in',
          'Select appropriate ITR form',
          'Manually enter data from the export',
          'Validate and submit'
        ],
        videoUrl: 'https://example.com/itr-portal-guide',
        supportUrl: 'https://incometaxindiaefiling.gov.in'
      }
    };
    
    const guide = guides[platform as keyof typeof guides] || {
      title: 'General Filing Guide',
      steps: ['Download exported data', 'Import to your preferred tax software'],
      videoUrl: null,
      supportUrl: null
    };
    
    res.json(guide);
  } catch (error) {
    console.error("Error fetching filing guide:", error);
    res.status(500).json({ error: "Failed to fetch filing guide" });
  }
});

// ============ END TAX DATA CENTER API ROUTES ============

// ============ SANDBOX ITR FILING API ROUTES ============

// Get ITR form data for user
app.get("/api/sandbox-itr/form/:pan/:year", async (req, res) => {
  try {
    const { pan, year } = req.params;
    
    if (!pan || !year) {
      return res.status(400).json({ error: "PAN and year are required" });
    }
    
    // Mock ITR form data - in production, fetch from database
    const itrFormData = {
      id: `itr-${pan}-${year}`,
      assessmentYear: year,
      formType: 'ITR-2',
      status: 'validated',
      totalIncome: 1250000,
      taxLiability: 78750,
      refundAmount: 46250,
      lastUpdated: new Date().toISOString()
    };
    
    res.json(itrFormData);
  } catch (error) {
    console.error("Error fetching ITR form data:", error);
    res.status(500).json({ error: "Failed to fetch ITR form data" });
  }
});

// Get validation results for ITR
app.get("/api/sandbox-itr/validation/:itrId", async (req, res) => {
  try {
    const { itrId } = req.params;
    
    if (!itrId) {
      return res.status(400).json({ error: "ITR ID is required" });
    }
    
    // Mock validation results - in production, run actual validation
    const validationResults = {
      errors: [],
      warnings: [],
      isValid: true,
      summary: {
        incomeSourcesVerified: true,
        tdsMatches: true,
        deductionsValid: true,
        taxComputationCorrect: true
      }
    };
    
    res.json(validationResults);
  } catch (error) {
    console.error("Error fetching validation results:", error);
    res.status(500).json({ error: "Failed to fetch validation results" });
  }
});

// Generate ITR for submission
app.post("/api/sandbox-itr/generate", async (req, res) => {
  try {
    const { itrId, mode } = req.body;
    
    if (!itrId) {
      return res.status(400).json({ error: "ITR ID is required" });
    }
    
    // Mock ITR generation - in production, generate actual ITR-XML
    const generateResult = {
      success: true,
      message: 'ITR generated successfully',
      xmlFile: `/api/sandbox-itr/download/${itrId}/xml`,
      jsonFile: `/api/sandbox-itr/download/${itrId}/json`,
      acknowledgmentNumber: `ITR${new Date().getFullYear()}${Math.random().toString().slice(2, 10)}`,
      generatedAt: new Date().toISOString()
    };
    
    res.json(generateResult);
  } catch (error) {
    console.error("Error generating ITR:", error);
    res.status(500).json({ error: "Failed to generate ITR" });
  }
});

// File ITR by ID with Income Tax Department (for pre-prepared ITRs)
// Note: Use /api/sandbox-itr/file for full form data filing via SandboxITRService
app.post("/api/sandbox-itr/submit-by-id", async (req, res) => {
  try {
    const { itrId } = req.body;
    
    if (!itrId) {
      return res.status(400).json({ error: "ITR ID is required" });
    }
    
    // Mock ITR filing - in production, submit to ITD portal
    const filingResult = {
      success: true,
      message: 'ITR filed successfully',
      acknowledgmentNumber: `ITR${new Date().getFullYear()}${Math.random().toString().slice(2, 10)}`,
      filedDate: new Date().toISOString(),
      status: 'Successfully Submitted',
      trackingUrl: `https://incometaxindiaefiling.gov.in/track/${Math.random().toString().slice(2, 15)}`
    };
    
    res.json(filingResult);
  } catch (error) {
    console.error("Error filing ITR:", error);
    res.status(500).json({ error: "Failed to file ITR" });
  }
});

// Auto-populate ITR data from tax sources
app.post("/api/sandbox-itr/auto-populate", async (req, res) => {
  try {
    const { pan, assessmentYear } = req.body;
    
    if (!pan || !assessmentYear) {
      return res.status(400).json({ error: "PAN and assessment year are required" });
    }
    
    // Mock auto-population - in production, fetch from tax data sources
    const populationResult = {
      success: true,
      message: 'ITR auto-populated from tax data sources',
      itrId: `itr-${pan}-${assessmentYear}`,
      dataSources: ['Form 26AS', 'AIS', 'CAMS', 'NSDL'],
      recordsProcessed: 127,
      populatedAt: new Date().toISOString()
    };
    
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    res.json(populationResult);
  } catch (error) {
    console.error("Error auto-populating ITR:", error);
    res.status(500).json({ error: "Failed to auto-populate ITR" });
  }
});

// Download ITR files
app.get("/api/sandbox-itr/download/:itrId/:format", async (req, res) => {
  try {
    const { itrId, format } = req.params;
    
    let contentType = 'application/octet-stream';
    let filename = `ITR-${itrId}.txt`;
    
    switch (format.toLowerCase()) {
      case 'pdf':
        contentType = 'application/pdf';
        filename = `ITR-${itrId}.pdf`;
        break;
      case 'xml':
        contentType = 'application/xml';
        filename = `ITR-${itrId}.xml`;
        break;
      case 'json':
        contentType = 'application/json';
        filename = `ITR-${itrId}.json`;
        break;
      default:
        return res.status(400).json({ error: 'Unsupported format' });
    }
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Mock file content - in production, generate actual ITR file
    const mockContent = `Mock ${format.toUpperCase()} content for ITR ${itrId}\nGenerated at: ${new Date().toISOString()}`;
    res.send(mockContent);
  } catch (error) {
    console.error("Error downloading ITR file:", error);
    res.status(500).json({ error: "Failed to download ITR file" });
  }
});

// ============ END SANDBOX ITR FILING API ROUTES ============


// ============ PARTNER APPLICATION ROUTES ============

// Get application prefill data
app.get("/api/partner-applications/prefill/:lender", async (req, res) => {
  try {
    const { lender } = req.params;
    const { recommendationId } = req.query;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Validate lender
    if (!providerRegistry.getAllLenders().includes(lender)) {
      return res.status(400).json({ error: "Invalid lender specified" });
    }

    const prefillData = await storage.getApplicationPrefillData(
      userId, 
      lender, 
      recommendationId as string
    );

    res.json({ 
      success: true, 
      data: prefillData,
      requiredFields: providerRegistry.getRequiredFields(lender),
      fieldMappings: providerRegistry.getFieldMappings(lender)
    });
  } catch (error) {
    console.error("Error fetching prefill data:", error);
    res.status(500).json({ error: "Failed to fetch prefill data" });
  }
});

// Create new partner application
}
