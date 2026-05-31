// @ts-nocheck
import { Express } from 'express';
import { storage } from '../storage';
import { db } from '../db';
import { eq, and, or } from 'drizzle-orm';
import { z } from 'zod';
import { requireLevel2 } from '../middleware/kyc-level-gate';
import { verifyBankAccountPennyDrop, validateIFSC, validateAccountNumber, isNameMatchAcceptable } from '../penny-drop-service';
import { lookupIFSC, isValidIFSCFormat } from '../ifsc-lookup-service';
import { ProductAccountService } from '../product-account-service';
import { BSEUCCService } from '../services/bse-ucc-service';
import { digilockerService } from '../services/digilockerService';
import { adminService } from '../admin-service';
import { getUserKYCLevel } from '../middleware/kyc-level-gate';
import * as schema from '@shared/schema';
import { insertProductAccountPreferenceSchema } from '@shared/schema';

const productAccountService = new ProductAccountService(null as any);

export function registerBankAccountsDemaPart2Routes(app: Express): void {
app.delete("/api/demat-accounts/:id", async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const account = await storage.getDematAccount(req.params.id);
    if (!account) {
      return res.status(404).json({ error: "Demat account not found" });
    }

    if (account.userId !== req.user!.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    const deleted = await storage.deleteDematAccount(req.params.id);
    if (deleted) {
      res.json({ success: true, message: "Demat account deleted successfully" });
    } else {
      res.status(404).json({ error: "Demat account not found" });
    }
  } catch (error) {
    console.error("Error deleting demat account:", error);
    res.status(500).json({ error: "Failed to delete demat account" });
  }
});

// Set default demat account
app.put("/api/demat-accounts/:id/set-default", async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const account = await storage.getDematAccount(req.params.id);
    if (!account) {
      return res.status(404).json({ error: "Demat account not found" });
    }

    if (account.userId !== req.user!.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    const { defaultType } = req.body;
    if (!["equity", "mutualFunds"].includes(defaultType)) {
      return res.status(400).json({ 
        error: "Invalid default type. Must be 'equity' or 'mutualFunds'" 
      });
    }

    const success = await storage.setDefaultDematAccount(req.params.id, defaultType);
    if (success) {
      res.json({ success: true, message: "Default demat account updated successfully" });
    } else {
      res.status(400).json({ error: "Failed to set default demat account" });
    }
  } catch (error) {
    console.error("Error setting default demat account:", error);
    res.status(500).json({ error: "Failed to set default demat account" });
  }
});

// ==================== Product Account Preference Routes ====================

// Get user's product account preferences
app.get("/api/product-account-preferences", async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const preferences = await storage.getUserProductAccountPreferences(req.user!.id);
    res.json(preferences);
  } catch (error) {
    console.error("Error fetching product account preferences:", error);
    res.status(500).json({ error: "Failed to fetch product account preferences" });
  }
});

// Get preference for specific product type
app.get("/api/product-account-preferences/:productType", async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const preference = await storage.getProductAccountPreference(
      req.user!.id, 
      req.params.productType
    );
    
    // Return null with 200 status when no preference exists (expected for new users)
    res.json(preference || null);
  } catch (error) {
    console.error("Error fetching product account preference:", error);
    res.status(500).json({ error: "Failed to fetch product account preference" });
  }
});

// Create product account preference
app.post("/api/product-account-preferences", async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Validate request body
    const validatedData = insertProductAccountPreferenceSchema.parse(req.body);

    // Override userId and server-managed fields to prevent tampering
    const preferenceData = {
      ...validatedData,
      userId: req.user!.id, // Force authenticated user's ID
      isActive: true, // Server manages this
      isDefault: true, // Server manages this
    };

    const preference = await storage.createProductAccountPreference(preferenceData);
    res.status(201).json(preference);
  } catch (error: any) {
    console.error("Error creating product account preference:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Invalid request data", details: error.issues });
    }
    res.status(500).json({ error: "Failed to create product account preference" });
  }
});

// Update product account preference
app.put("/api/product-account-preferences/:id", async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // First, verify the preference exists and belongs to the user
    const preferences = await storage.getUserProductAccountPreferences(req.user!.id);
    const existingPref = preferences.find(p => p.id === req.params.id);
    
    if (!existingPref) {
      return res.status(404).json({ error: "Preference not found or access denied" });
    }

    // Validate request body (partial schema - only allow specific fields)
    const updateSchema = insertProductAccountPreferenceSchema.pick({
      bankAccountId: true,
      dematAccountId: true,
    }).partial();
    
    const validatedData = updateSchema.parse(req.body);

    const updated = await storage.updateProductAccountPreference(req.params.id, validatedData);
    
    if (!updated) {
      return res.status(404).json({ error: "Preference not found" });
    }

    res.json(updated);
  } catch (error: any) {
    console.error("Error updating product account preference:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Invalid request data", details: error.issues });
    }
    res.status(500).json({ error: "Failed to update product account preference" });
  }
});

// Delete product account preference
app.delete("/api/product-account-preferences/:id", async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // First, verify the preference exists and belongs to the user
    const preferences = await storage.getUserProductAccountPreferences(req.user!.id);
    const existingPref = preferences.find(p => p.id === req.params.id);
    
    if (!existingPref) {
      return res.status(404).json({ error: "Preference not found or access denied" });
    }

    const deleted = await storage.deleteProductAccountPreference(req.params.id);
    
    if (deleted) {
      res.json({ success: true, message: "Preference deleted successfully" });
    } else {
      res.status(404).json({ error: "Preference not found" });
    }
  } catch (error) {
    console.error("Error deleting product account preference:", error);
    res.status(500).json({ error: "Failed to delete product account preference" });
  }
});

// Get recommended accounts for a product type
app.get("/api/product-accounts/:productType", async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const accounts = await productAccountService.getAccountsForProduct(
      req.user!.id,
      req.params.productType
    );
    
    res.json(accounts);
  } catch (error) {
    console.error("Error getting product accounts:", error);
    res.status(500).json({ error: "Failed to get product accounts" });
  }
});

// Validate accounts for a product type
app.post("/api/product-accounts/:productType/validate", async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Validate request body
    const validationSchema = z.object({
      bankAccountId: z.string().optional(),
      dematAccountId: z.string().optional(),
    });

    const { bankAccountId, dematAccountId } = validationSchema.parse(req.body);

    // Check if product type is valid
    const requirements = productAccountService.getProductRequirements(req.params.productType);
    if (!requirements) {
      return res.status(400).json({ error: "Invalid product type" });
    }

    const validation = await productAccountService.validateAccountsForProduct(
      req.user!.id,
      req.params.productType,
      bankAccountId,
      dematAccountId
    );
    
    res.json(validation);
  } catch (error: any) {
    console.error("Error validating product accounts:", error);
    if (error.name === "ZodError") {
      return res.status(400).json({ error: "Invalid request data", details: error.issues });
    }
    res.status(500).json({ error: "Failed to validate product accounts" });
  }
});

// Get product requirements
app.get("/api/product-requirements/:productType", async (req, res) => {
  try {
    const requirements = productAccountService.getProductRequirements(req.params.productType);
    res.json(requirements);
  } catch (error) {
    console.error("Error getting product requirements:", error);
    res.status(500).json({ error: "Failed to get product requirements" });
  }
});

// ===== BSE STAR KYC API ROUTES =====

// Verify PAN using BSE Star API
app.post("/api/bse-kyc/verify-pan", async (req, res) => {
  try {
    const { panNumber } = req.body;
    
    if (!panNumber) {
      return res.status(400).json({ error: "PAN number is required" });
    }

    const { bseStarKYCService } = await import('../services/bse-star-kyc-service');
    const result = await bseStarKYCService.verifyPAN(panNumber);
    
    res.json(result);
  } catch (error) {
    console.error("BSE PAN verification error:", error);
    res.status(500).json({ 
      error: "PAN verification failed",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Check KYC status using BSE Star API
app.post("/api/bse-kyc/check-status", async (req, res) => {
  try {
    const { panNumber, name, dob, mobile, email } = req.body;
    
    if (!panNumber) {
      return res.status(400).json({ error: "PAN number is required" });
    }

    const { bseStarKYCService } = await import('../services/bse-star-kyc-service');
    const result = await bseStarKYCService.checkKYCStatus({
      panNumber,
      name,
      dob,
      mobile,
      email
    });
    
    res.json(result);
  } catch (error) {
    console.error("BSE KYC status check error:", error);
    res.status(500).json({ 
      error: "KYC status check failed",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// Auto-populate KYC using BSE Star API
app.post("/api/bse-kyc/auto-populate", async (req, res) => {
  try {
    const { panNumber } = req.body;
    
    if (!panNumber) {
      return res.status(400).json({ error: "PAN number is required" });
    }

    const { bseStarKYCService } = await import('../services/bse-star-kyc-service');
    const kycData = await bseStarKYCService.autoPopulateKYC(panNumber);
    
    res.json({ 
      success: true, 
      kycData,
      source: 'bse_star'
    });
  } catch (error) {
    console.error("BSE KYC auto-populate error:", error);
    res.status(500).json({ 
      error: "KYC auto-populate failed",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// BSE API health check
app.get("/api/bse-kyc/health", async (req, res) => {
  try {
    const { bseStarKYCService } = await import('../services/bse-star-kyc-service');
    const isHealthy = await bseStarKYCService.healthCheck();
    
    res.json({ 
      status: isHealthy ? 'healthy' : 'unhealthy',
      service: 'BSE Star KYC API',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("BSE health check error:", error);
    res.status(503).json({ 
      status: 'unhealthy',
      service: 'BSE Star KYC API',
      error: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

// ===== BSE UCC (Unique Client Code) ROUTES =====

// Create UCC for mutual fund trading (requires Level 2 KYC)
app.post("/api/bse/ucc/create", requireLevel2, async (req: any, res) => {
  try {
    const userId = req.user!.id;
    
    // Import BSE UCC service
    const { bseUCCService } = await import('../services/bse-ucc-service');
    
    // Double-check KYC Level 2 (middleware already validates, but extra safety)
    const { level } = await getUserKYCLevel(userId);
    if (level !== '2') {
      return res.status(403).json({
        success: false,
        error: 'KYC Level 2 required',
        message: 'You must complete full KYC verification before creating a UCC for mutual fund trading',
        kycLevel: level,
        requiredLevel: '2',
        nextStep: {
          action: 'complete_full_kyc',
          url: '/onboarding',
          description: 'Complete CKYC and KRA verification to unlock mutual fund trading'
        }
      });
    }
    
    // Check if user already has a UCC
    const existingProfile = await storage.getUserProfile(userId);
    if ((existingProfile as any)?.bseUccCode) {
      return res.status(400).json({
        success: false,
        error: 'UCC already exists',
        message: 'You already have a BSE UCC code',
        uccCode: (existingProfile as any).bseUccCode,
        clientCode: (existingProfile as any).bseClientCode
      });
    }
    
    // Validate required fields from request body
    const {
      panNumber,
      firstName,
      middleName,
      lastName,
      dateOfBirth,
      gender,
      mobile,
      email,
      addressLine1,
      addressLine2,
      city,
      state,
      pincode,
      country,
      bankAccountNumber,
      bankIfscCode,
      bankAccountType,
      occupation,
      annualIncome,
      nomineeName,
      nomineeRelationship,
      nomineeDob,
      taxStatus,
      taxResidency,
      isTaxResident,
      isPEP,
      ckycNumber
    } = req.body;
    
    // Validate required fields
    if (!panNumber || !firstName || !lastName || !dateOfBirth || !gender || !mobile || !email) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        message: 'PAN number, first name, last name, date of birth, gender, mobile, and email are required'
      });
    }
    
    if (!addressLine1 || !city || !state || !pincode) {
      return res.status(400).json({
        success: false,
        error: 'Missing address fields',
        message: 'Address line 1, city, state, and pincode are required'
      });
    }
    
    if (!bankAccountNumber || !bankIfscCode || !bankAccountType) {
      return res.status(400).json({
        success: false,
        error: 'Missing bank details',
        message: 'Bank account number, IFSC code, and account type are required'
      });
    }
    
    // Create UCC via BSE Star API
    const uccRequest = {
      firstName,
      middleName,
      lastName,
      dateOfBirth,
      gender,
      panNumber,
      ckycNumber,
      mobile,
      email,
      addressLine1,
      addressLine2,
      city,
      state,
      pincode,
      country: country || 'India',
      bankAccountNumber,
      bankIfscCode,
      bankAccountType,
      occupation,
      annualIncome,
      nomineeName,
      nomineeRelationship,
      nomineeDob,
      taxStatus: taxStatus || 'INDIVIDUAL',
      taxResidency,
      isTaxResident,
      isPEP
    };
    
    const uccResult = await bseUCCService.createUCC(uccRequest);
    
    if (!uccResult.success) {
      return res.status(400).json({
        success: false,
        error: 'UCC creation failed',
        message: uccResult.message,
        errors: uccResult.errors
      });
    }
    
    // Store UCC code in user profile
    await db.update(schema.userProfiles)
      .set({
        bseUccCode: uccResult.uccCode,
        bseClientCode: uccResult.clientCode || uccResult.uccCode,
        bseUccCreatedAt: new Date(),
        bseUccStatus: "active"
      } as any)
      .where(eq(schema.userProfiles.userId, userId));
    // Log activity
    adminService.logActivity({
      userId,
      action: 'bse_ucc_created',
      resource: '/api/bse/ucc/create',
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      details: {
        uccCode: uccResult.uccCode,
        clientCode: uccResult.clientCode,
        bseReference: uccResult.bseReference
      }
    }).catch(console.error);
    
    res.json({
      success: true,
      message: 'UCC created successfully',
      uccCode: uccResult.uccCode,
      clientCode: uccResult.clientCode,
      bseReference: uccResult.bseReference
    });
  } catch (error) {
    console.error("BSE UCC creation error:", error);
    res.status(500).json({
      success: false,
      error: 'UCC creation failed',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Get UCC status for current user
app.get("/api/bse/ucc/status", requireLevel2, async (req: any, res) => {
  try {
    const userId = req.user!.id;
    
    // Fetch user profile
    const profile = await storage.getUserProfile(userId);
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        error: 'Profile not found',
        message: 'User profile not found'
      });
    }
    
    res.json({
      success: true,
      hasUCC: !!(profile as any).bseUccCode,
      uccCode: (profile as any).bseUccCode || null,
      clientCode: (profile as any).bseClientCode || null,
      uccStatus: (profile as any).bseUccStatus || null,
      createdAt: (profile as any).bseUccCreatedAt || null
    });
  } catch (error) {
    console.error("BSE UCC status error:", error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch UCC status',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

// Fetch document content (force refresh)
app.post("/api/digilocker/documents/:documentId/fetch", async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const { documentId } = req.params;
    const document = await digilockerService.getDocument(documentId);
    
    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    // Verify user owns this document
    if (document.userId !== req.user!.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    await digilockerService.fetchDocumentContent(documentId);
    const updatedDocument = await digilockerService.getDocument(documentId);
    
    res.json({ success: true, document: updatedDocument });
  } catch (error) {
    console.error("Error fetching DigiLocker document content:", error);
    res.status(500).json({ error: "Failed to fetch document content" });
  }
});

// ===== TAX DOCUMENT ROUTES =====

// Upload tax document (26AS, AIS, etc.)

}
