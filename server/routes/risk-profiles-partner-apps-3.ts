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

export function registerRiskProfilesPartnerAppPart3Routes(app: Express): void {
  const requireOwnPortfolio = buildRequireOwnPortfolio(storage);
app.post("/api/partner-applications", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Validate request body
    const validatedData = insertPartnerApplicationSchema.parse({
      ...req.body,
      userId,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Validate application data using provider adapter
    const validation = providerRegistry.validateApplicationData(
      validatedData.lender, 
      (validatedData as any).applicationData as UnifiedApplicationData
    );

    if (!validation.isValid) {
      return res.status(400).json({ 
        error: "Application validation failed",
        validationErrors: validation.issues 
      });
    }

    const application = await storage.createPartnerApplication(validatedData);

    res.status(201).json({ 
      success: true, 
      data: application 
    });
  } catch (error) {
    console.error("Error creating partner application:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: "Invalid application data", 
        validationErrors: error.issues 
      });
    }
    res.status(500).json({ error: "Failed to create application" });
  }
});

// Get user's applications
app.get("/api/partner-applications", async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const applications = await storage.getPartnerApplicationsByUserId(userId);
    res.json({ success: true, data: applications });
  } catch (error) {
    console.error("Error fetching partner applications:", error);
    res.status(500).json({ error: "Failed to fetch applications" });
  }
});

// Get specific application
app.get("/api/partner-applications/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const application = await storage.getPartnerApplication(id);
    
    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    // Check if user owns this application
    if (application.userId !== userId) {
      return res.status(403).json({ error: "Access denied" });
    }

    res.json({ success: true, data: application });
  } catch (error) {
    console.error("Error fetching partner application:", error);
    res.status(500).json({ error: "Failed to fetch application" });
  }
});

// Update application
app.put("/api/partner-applications/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Verify application ownership
    const existingApplication = await storage.getPartnerApplication(id);
    if (!existingApplication || existingApplication.userId !== userId) {
      return res.status(404).json({ error: "Application not found" });
    }

    // Validate updated data if provided
    if (req.body.applicationData) {
      const validation = providerRegistry.validateApplicationData(
        existingApplication.lender,
        req.body.applicationData as UnifiedApplicationData
      );

      if (!validation.isValid) {
        return res.status(400).json({
          error: "Application validation failed",
          validationErrors: validation.issues
        });
      }
    }

    const updatedApplication = await storage.updatePartnerApplication(id, {
      ...req.body,
      updatedAt: new Date()
    });

    res.json({ success: true, data: updatedApplication });
  } catch (error) {
    console.error("Error updating partner application:", error);
    res.status(500).json({ error: "Failed to update application" });
  }
});

// Submit application to lender
app.post("/api/partner-applications/:id/submit", async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Get application
    const application = await storage.getPartnerApplication(id);
    if (!application || application.userId !== userId) {
      return res.status(404).json({ error: "Application not found" });
    }

    if (application.status !== 'draft') {
      return res.status(400).json({ error: "Application has already been submitted" });
    }

    // Transform data to provider format
    const providerRequest = providerRegistry.transformToProviderFormat(
      application.lender,
      (application as any).applicationData as UnifiedApplicationData
    );

    // Submit to provider API (this would be the actual API call)
    // For now, we'll simulate the submission
    const mockProviderResponse = {
      application_id: `${application.lender.toUpperCase()}_${Date.now()}`,
      status: 'submitted',
      reference_id: `REF_${Date.now()}`,
      submission_timestamp: new Date().toISOString(),
      next_steps: "Documents verification in progress"
    };

    // Transform provider response
    const statusUpdate = providerRegistry.transformFromProviderFormat(
      application.lender,
      mockProviderResponse
    );

    // Update application status
    const updatedApplication = await storage.updateApplicationStatus(
      id,
      'submitted',
      statusUpdate.providerApplicationId || undefined,
      [
        {
          status: 'submitted',
          timestamp: new Date(),
          message: 'Application successfully submitted to lender',
          source: 'system'
        }
      ]
    );

    res.json({
      success: true,
      data: updatedApplication,
      providerResponse: mockProviderResponse
    });
  } catch (error) {
    console.error("Error submitting partner application:", error);
    res.status(500).json({ error: "Failed to submit application" });
  }
});

// Get application status from provider
app.get("/api/partner-applications/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const application = await storage.getPartnerApplication(id);
    if (!application || application.userId !== userId) {
      return res.status(404).json({ error: "Application not found" });
    }

    if (!application.providerApplicationId) {
      return res.status(400).json({ error: "Application not yet submitted to provider" });
    }

    // Mock status check - in production, this would call the provider API
    const mockStatusResponse = {
      applicationId: application.providerApplicationId,
      currentStatus: application.status,
      statusHistory: application.statusUpdates || [],
      lastUpdated: application.updatedAt,
      expectedNextUpdate: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours from now
      documents_required: [],
      notes: "Application is under review by our credit team"
    };

    res.json({
      success: true,
      data: mockStatusResponse
    });
  } catch (error) {
    console.error("Error fetching application status:", error);
    res.status(500).json({ error: "Failed to fetch application status" });
  }
});

// Get available lenders and their requirements
app.get("/api/partner-applications/lenders", async (req, res) => {
  try {
    const lenders = providerRegistry.getAllLenders();
    const lenderInfo = lenders.map(lender => ({
      name: lender,
      displayName: lender.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      requiredFields: providerRegistry.getRequiredFields(lender),
      fieldMappings: providerRegistry.getFieldMappings(lender)
    }));

    res.json({
      success: true,
      data: lenderInfo
    });
  } catch (error) {
    console.error("Error fetching lender information:", error);
    res.status(500).json({ error: "Failed to fetch lender information" });
  }
});

// Document upload for partner applications
app.get("/api/partner-applications/upload-url", requireAuth, async (req, res) => {
  try {
    const objectStorageService = new ObjectStorageService();
    const uploadUrl = await objectStorageService.getObjectEntityUploadURL();
    
    res.json({
      success: true,
      data: {
        uploadUrl,
        method: 'PUT'
      }
    });
  } catch (error) {
    console.error("Error generating upload URL:", error);
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

// Associate uploaded document with application
app.post("/api/partner-applications/:applicationId/documents", requireAuth, async (req, res) => {
  try {
    const { applicationId } = req.params;
    
    // Validate request body using Zod schema
    const validationResult = insertPartnerApplicationDocumentSchema.extend({
      uploadedUrl: z.string().url("Invalid upload URL"),
      mimeType: z.string().optional(),
    }).omit({
      id: true,
      createdAt: true,
      updatedAt: true,
      uploadedAt: true,
      uploadedBy: true,
      applicationId: true,
      userId: true,
      filePath: true,
      originalUrl: true,
    } as any).safeParse(req.body as any);
    
    if (!validationResult.success) {
      return res.status(400).json({ 
        error: "Invalid document data",
        details: validationResult.error.issues
      });
    }
    
    const { documentType, fileName, fileSize, uploadedUrl, mimeType } = validationResult.data as any;

    // Verify application exists and belongs to user
    const application = await storage.getPartnerApplication(applicationId);
    if (!application || application.userId !== req.user!.id) {
      return res.status(404).json({ error: "Application not found" });
    }

    // Normalize the object path  
    const objectStorageService = new ObjectStorageService();
    const normalizedPath = objectStorageService.normalizeObjectEntityPath(uploadedUrl);
    
    // Set ACL policy for document access
    await objectStorageService.trySetObjectEntityAclPolicy(normalizedPath, {
      visibility: 'private',
      allowedUsers: [req.user!.id]
    } as any);

    // Store document metadata in database
    const documentRecord = await storage.createApplicationDocument({
      applicationId,
      userId: req.user!.id,
      documentType,
      fileName,
      fileSize: fileSize || 0,
      filePath: normalizedPath,
      originalUrl: uploadedUrl,
      uploadedBy: req.user!.id
    });

    res.json({
      success: true,
      data: documentRecord
    });
  } catch (error) {
    console.error("Error associating document:", error);
    res.status(500).json({ error: "Failed to associate document with application" });
  }
});

// Get documents for an application
app.get("/api/partner-applications/:applicationId/documents", requireAuth, async (req, res) => {
  try {
    const { applicationId } = req.params;
    
    // Verify application exists and belongs to user
    const application = await storage.getPartnerApplication(applicationId);
    if (!application || application.userId !== req.user!.id) {
      return res.status(404).json({ error: "Application not found" });
    }
    
    // Fetch documents from database
    const documents = await storage.getApplicationDocuments(applicationId);
    
    res.json({
      success: true,
      data: documents
    });
  } catch (error) {
    console.error("Error fetching application documents:", error);
    res.status(500).json({ error: "Failed to fetch application documents" });
  }
});

// Delete application document
app.delete("/api/partner-applications/:applicationId/documents/:documentId", requireAuth, async (req, res) => {
  try {
    const { applicationId, documentId } = req.params;
    const userId = req.user!.id;

    // Verify application ownership
    const application = await storage.getPartnerApplication(applicationId);
    if (!application || application.userId !== userId) {
      return res.status(404).json({ error: "Application not found" });
    }

    // Get document to verify ownership and get file path
    const document = await storage.getApplicationDocument(documentId);
    if (!document || document.applicationId !== applicationId || document.userId !== userId) {
      return res.status(404).json({ error: "Document not found" });
    }

    // Delete from object storage
    try {
      const objectStorageService = new ObjectStorageService();
      await (objectStorageService as any).deleteObject(document.filePath);
    } catch (storageError) {
      console.warn('Failed to delete object from storage:', storageError);
      // Continue with database deletion even if object storage fails
    }

    // Delete from database
    const deleted = await storage.deleteApplicationDocument(documentId);
    if (!deleted) {
      return res.status(404).json({ error: "Document not found" });
    }

    res.json({ 
      success: true, 
      message: "Document deleted successfully" 
    });
  } catch (error) {
    console.error('Error deleting application document:', error);
    res.status(500).json({ error: "Failed to delete document" });
  }
});

// Update application document metadata
app.patch("/api/partner-applications/:applicationId/documents/:documentId", requireAuth, async (req, res) => {
  try {
    const { applicationId, documentId } = req.params;
    const userId = req.user!.id;

    // Verify application ownership
    const application = await storage.getPartnerApplication(applicationId);
    if (!application || application.userId !== userId) {
      return res.status(404).json({ error: "Application not found" });
    }

    // Get document to verify ownership
    const document = await storage.getApplicationDocument(documentId);
    if (!document || document.applicationId !== applicationId || document.userId !== userId) {
      return res.status(404).json({ error: "Document not found" });
    }

    // Allow updating verification status
    const { isVerified } = req.body;
    const updates: any = {};
    
    if (typeof isVerified === 'boolean') {
      updates.isVerified = isVerified;
      if (isVerified) {
        updates.verifiedBy = userId;
        updates.verifiedAt = new Date();
      } else {
        updates.verifiedBy = null;
        updates.verifiedAt = null;
      }
    }

    const updatedDocument = await storage.updateApplicationDocument(documentId, updates);
    if (!updatedDocument) {
      return res.status(404).json({ error: "Document not found" });
    }

    res.json({
      success: true,
      data: updatedDocument
    });
  } catch (error) {
    console.error('Error updating application document:', error);
    res.status(500).json({ error: "Failed to update document" });
  }
});

// ============ END PARTNER APPLICATION ROUTES ============




// ============ ACHIEVEMENT SYSTEM ROUTES ============

// Get user achievements with their progress
app.get("/api/achievements/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Mock achievement data for demo purposes
    const achievements = [
      {
        id: '1',
        achievementId: 'first-portfolio',
        userId: userId,
        earnedAt: new Date().toISOString(),
        progress: '100',
        isCompleted: true,
        sharedCount: 2,
        achievement: {
          id: 'first-portfolio',
          name: 'Portfolio Pioneer',
          description: 'Created your first investment portfolio',
          points: 100,
          difficulty: 'beginner',
          category: 'Portfolio Management',
          shareTemplate: '🎯 Just created my first investment portfolio on FintekPro!'
        }
      },
      {
        id: '2',
        achievementId: 'portfolio-diversifier',
        userId: userId,
        earnedAt: new Date().toISOString(),
        progress: '75',
        isCompleted: false,
        sharedCount: 0,
        achievement: {
          id: 'portfolio-diversifier',
          name: 'Diversification Master',
          description: 'Diversify your portfolio across 5 different asset classes',
          points: 250,
          difficulty: 'intermediate',
          category: 'Portfolio Management'
        }
      },
      {
        id: '3',
        achievementId: 'learning-streak',
        userId: userId,
        earnedAt: new Date().toISOString(),
        progress: '100',
        isCompleted: true,
        sharedCount: 1,
        achievement: {
          id: 'learning-streak',
          name: 'Knowledge Seeker',
          description: 'Completed 10 financial learning modules',
          points: 200,
          difficulty: 'intermediate',
          category: 'Learning & Education'
        }
      }
    ];
    
    res.json(achievements);
  } catch (error) {
    console.error("Error fetching user achievements:", error);
    res.status(500).json({ error: "Failed to fetch achievements" });
  }
});

// Get user achievement statistics
app.get("/api/achievements/stats/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Mock stats for demo
    const stats = {
      totalPoints: 300,
      completedAchievements: 2,
      categories: {
        'Portfolio Management': 1,
        'Learning & Education': 1
      }
    };
    
    res.json(stats);
  } catch (error) {
    console.error("Error fetching achievement stats:", error);
    res.status(500).json({ error: "Failed to fetch achievement stats" });
  }
});

// Get achievement leaderboard
app.get("/api/achievements/leaderboard", async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    
    // Mock leaderboard data
    const leaderboard = [
      {
        userId: 'user-1',
        totalPoints: 1250,
        completedAchievements: 8,
        user: { id: 'user-1', firstName: 'Alex', lastName: 'Johnson', email: 'alex@example.com' }
      },
      {
        userId: 'central-test-user',
        totalPoints: 300,
        completedAchievements: 2,
        user: { id: 'central-test-user', firstName: 'Test', lastName: 'SuperUser', email: 'test@fintekpro.com' }
      },
      {
        userId: 'user-3',
        totalPoints: 180,
        completedAchievements: 3,
        user: { id: 'user-3', firstName: 'Sarah', lastName: 'Wilson', email: 'sarah@example.com' }
      }
    ].slice(0, Number(limit));
    
    res.json(leaderboard);
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

// Create social share record
app.post("/api/achievements/share", async (req, res) => {
  try {
    const { achievementId, userId, platform, shareUrl, shareContent } = req.body;
    
    // Mock social share creation
    const share = {
      id: Date.now().toString(),
      achievementId,
      userId,
      platform,
      shareUrl,
      shareContent,
      createdAt: new Date().toISOString(),
      engagementData: {}
    };
    
    res.status(201).json(share);
  } catch (error) {
    console.error("Error creating social share:", error);
    res.status(500).json({ error: "Failed to create social share" });
  }
});

// Record learning progress
app.post("/api/achievements/progress", async (req, res) => {
  try {
    const { userId, action, category, metadata } = req.body;
    
    // Mock progress recording
    const progress = {
      id: Date.now().toString(),
      userId,
      action,
      category,
      metadata,
      createdAt: new Date().toISOString()
    };
    
    // Check for any achievements that should be triggered
    // This would be implemented based on business logic
    
    res.status(201).json(progress);
  } catch (error) {
    console.error("Error recording progress:", error);
    res.status(500).json({ error: "Failed to record progress" });
  }
});

// Get all achievement categories
app.get("/api/achievements/categories", async (req, res) => {
  try {
    // Mock categories
    const categories = [
      {
        id: 'portfolio',
        name: 'Portfolio Management',
        description: 'Master the art of portfolio construction and management',
        color: '#3B82F6'
      },
      {
        id: 'learning',
        name: 'Learning & Education',
        description: 'Expand your financial knowledge and expertise',
        color: '#10B981'
      },
      {
        id: 'trading',
        name: 'Trading',
        description: 'Develop trading skills and market understanding',
        color: '#F59E0B'
      },
      {
        id: 'risk',
        name: 'Risk Management',
        description: 'Learn to assess and manage investment risks',
        color: '#EF4444'
      }
    ];
    
    res.json(categories);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ error: "Failed to fetch categories" });
  }
});

// ============ END ACHIEVEMENT SYSTEM ROUTES ============


}
