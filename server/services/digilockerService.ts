import { eq, and } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import crypto from "crypto";
import {
  digilockerApps,
  digilockerSharedDocuments,
  digilockerUserSessions,
  digilockerKycMappings,
  type DigilockerApp,
  type DigilockerSharedDocument,
  type DigilockerUserSession,
  type DigilockerKycMapping,
  type InsertDigilockerApp,
  type InsertDigilockerSharedDocument,
  type InsertDigilockerUserSession,
  type InsertDigilockerKycMapping,
} from "../../shared/schema";
import { v4 as uuidv4 } from "uuid";

// Database connection
const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

// DigiLocker Service Configuration
const DIGILOCKER_CONFIG = {
  DEVELOPMENT: {
    WIDGET_BASE_URL: "https://devservices.digitallocker.gov.in/requester/api/2/dl.js",
    API_BASE_URL: "https://devpartners.digitallocker.gov.in/public/requestor/api/pulldoc/1/xml",
  },
  PRODUCTION: {
    WIDGET_BASE_URL: "https://services.digitallocker.gov.in/requester/api/2/dl.js",
    API_BASE_URL: "https://partners.digitallocker.gov.in/public/requestor/api/pulldoc/1/xml",
  }
};

export interface DigiLockerDocumentMetadata {
  docId: string;
  uri: string;
  docType: string;
  source: 'I' | 'U'; // I = Issued, U = Uploaded
  txn: string;
  filename: string;
  contentType: string;
  sharedTill: string;
}

export interface DigiLockerWidgetConfig {
  appId: string;
  appHash: string;
  timestamp: number;
  callbackFunction: string;
  environment: 'development' | 'production';
}

export interface DigiLockerPullDocRequest {
  uri: string;
  txn: string;
  orgId: string;
  appId: string;
  apiKey: string;
}

export class DigiLockerService {
  // Initialize default DigiLocker app configuration
  async initializeDigiLockerApp() {
    try {
      // Check if default app already exists
      const existingApp = await db.select().from(digilockerApps).limit(1);
      
      if (existingApp.length === 0) {
        // Create default DigiLocker app configuration
        const defaultApp: InsertDigilockerApp = {
          appName: "FintekPro KYC Platform",
          appId: process.env.DIGILOCKER_APP_ID || "FINTEK_APP_001",
          apiKey: process.env.DIGILOCKER_API_KEY || "sample_api_key_for_development",
          orgId: process.env.DIGILOCKER_ORG_ID || "FINTEK_ORG_001",
          domain: process.env.REPLIT_DOMAIN || "localhost:5000",
          environment: "development",
          documentTypesAllowed: ["issued", "uploaded"],
          isActive: true,
        };

        await db.insert(digilockerApps).values(defaultApp);
        console.log("✅ DigiLocker app configuration initialized successfully");
      }
    } catch (error) {
      console.error("❌ Error initializing DigiLocker app:", error);
      throw error;
    }
  }

  // Get active DigiLocker app configuration
  async getActiveApp(): Promise<DigilockerApp | null> {
    const [app] = await db
      .select()
      .from(digilockerApps)
      .where(eq(digilockerApps.isActive, true))
      .limit(1);
    
    return app || null;
  }

  // Generate authentication hash for DigiLocker widget
  generateAuthHash(appId: string, apiKey: string, timestamp: number): string {
    const dataToHash = `${appId}${apiKey}${timestamp}`;
    return crypto.createHash('sha256').update(dataToHash).digest('hex');
  }

  // Generate widget configuration for frontend
  async generateWidgetConfig(callbackFunction: string = "handleDigiLockerCallback"): Promise<DigiLockerWidgetConfig | null> {
    const app = await this.getActiveApp();
    if (!app) {
      throw new Error("No active DigiLocker app configuration found");
    }

    const timestamp = Math.floor(Date.now() / 1000); // Unix timestamp in seconds
    const appHash = this.generateAuthHash(app.appId, app.apiKey, timestamp);

    return {
      appId: app.appId,
      appHash,
      timestamp,
      callbackFunction,
      environment: app.environment as 'development' | 'production',
    };
  }

  // Handle document sharing callback from DigiLocker widget
  async handleDocumentSharing(
    userId: string, 
    metadata: DigiLockerDocumentMetadata
  ): Promise<DigilockerSharedDocument> {
    const app = await this.getActiveApp();
    if (!app) {
      throw new Error("No active DigiLocker app configuration found");
    }

    // Parse shared till date to string format
    let sharedTillString: string | null = null;
    if (metadata.sharedTill && metadata.sharedTill !== "") {
      // Input format is DD-MM-YYYY, convert to YYYY-MM-DD for database
      const [day, month, year] = metadata.sharedTill.split('-');
      sharedTillString = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    const documentData: InsertDigilockerSharedDocument = {
      userId,
      appId: app.id,
      documentUri: metadata.uri,
      documentType: metadata.docType,
      source: metadata.source,
      transactionId: metadata.txn,
      filename: metadata.filename,
      contentType: metadata.contentType,
      sharedTill: sharedTillString,
      sharingStatus: "shared",
    };

    const [insertedDocument] = await db
      .insert(digilockerSharedDocuments)
      .values([documentData])
      .returning();

    // Auto-fetch the document content
    try {
      await this.fetchDocumentContent(insertedDocument.id);
    } catch (error) {
      console.error("Error auto-fetching document content:", error);
      // Continue without failing the sharing process
    }

    return insertedDocument;
  }

  // Fetch document content from DigiLocker API
  async fetchDocumentContent(documentId: string): Promise<void> {
    const [document] = await db
      .select()
      .from(digilockerSharedDocuments)
      .where(eq(digilockerSharedDocuments.id, documentId))
      .limit(1);

    if (!document) {
      throw new Error("Document not found");
    }

    const app = await this.getActiveApp();
    if (!app) {
      throw new Error("No active DigiLocker app configuration found");
    }

    try {
      const timestamp = new Date().toISOString();
      const keyHash = crypto.createHash('sha256')
        .update(app.apiKey + timestamp)
        .digest('hex');

      // Build XML request for DigiLocker API
      const xmlRequest = `<?xml version="1.0" encoding="UTF-8"?>
<PullDocRequest xmlns:ns2="http://tempuri.org/" ver="1.0" ts="${timestamp}" txn="${document.transactionId}" orgId="${app.orgId}" appId="${app.appId}" keyhash="${keyHash}">
  ${document.documentUri}
</PullDocRequest>`;

      const apiUrl = app.environment === 'production' 
        ? DIGILOCKER_CONFIG.PRODUCTION.API_BASE_URL
        : DIGILOCKER_CONFIG.DEVELOPMENT.API_BASE_URL;

      // In a real implementation, you would make the actual API call here
      // For development/demo purposes, we'll simulate a successful response
      const mockDocumentContent = this.generateMockDocumentContent(document.documentType, document.contentType);

      // Update document with fetched content
      await db
        .update(digilockerSharedDocuments)
        .set({
          documentContent: mockDocumentContent,
          fetchedAt: new Date(),
          sharingStatus: "fetched",
        })
        .where(eq(digilockerSharedDocuments.id, documentId));

      console.log(`✅ Document content fetched for ${document.documentType}`);
    } catch (error) {
      // Update status to failed
      await db
        .update(digilockerSharedDocuments)
        .set({
          sharingStatus: "fetch_failed",
        })
        .where(eq(digilockerSharedDocuments.id, documentId));

      console.error("Error fetching document content:", error);
      throw error;
    }
  }

  // Generate mock document content for development
  private generateMockDocumentContent(documentType: string, contentType: string): string {
    // In a real implementation, this would be the actual base64 content from DigiLocker
    const mockData = {
      documentType,
      contentType,
      fetchedAt: new Date().toISOString(),
      verified: true,
      issuer: documentType.includes('Aadhaar') ? 'UIDAI' : 
               documentType.includes('PAN') ? 'Income Tax Department' :
               documentType.includes('Driving') ? 'Transport Department' : 'Government of India',
      status: 'active'
    };
    
    return Buffer.from(JSON.stringify(mockData)).toString('base64');
  }

  // Map DigiLocker documents to KYC fields
  async mapDocumentToKYC(
    userId: string,
    documentId: string,
    kycFieldName: string
  ): Promise<DigilockerKycMapping> {
    const mappingData: InsertDigilockerKycMapping = {
      userId,
      digilockerDocId: documentId,
      documentType: "auto-detected", // Will be updated based on document
      kycFieldName,
      verificationStatus: "pending",
      autoPopulated: true,
    };

    const [mapping] = await db
      .insert(digilockerKycMappings)
      .values(mappingData)
      .returning();

    return mapping;
  }

  // Get user's DigiLocker documents
  async getUserDocuments(userId: string): Promise<DigilockerSharedDocument[]> {
    return await db
      .select()
      .from(digilockerSharedDocuments)
      .where(eq(digilockerSharedDocuments.userId, userId));
  }

  // Get document by ID
  async getDocument(documentId: string): Promise<DigilockerSharedDocument | null> {
    const [document] = await db
      .select()
      .from(digilockerSharedDocuments)
      .where(eq(digilockerSharedDocuments.id, documentId))
      .limit(1);

    return document || null;
  }

  // Auto-populate KYC fields from DigiLocker documents
  async autoPopulateKYCFields(userId: string): Promise<any> {
    const documents = await this.getUserDocuments(userId);
    const kycData: any = {};

    for (const doc of documents) {
      if (doc.sharingStatus === 'fetched' && doc.documentContent) {
        try {
          // In a real implementation, you would parse the actual document content
          // For development, we'll use the mock data structure
          const content = JSON.parse(Buffer.from(doc.documentContent, 'base64').toString());
          
          // Map document types to KYC fields
          if (doc.documentType.toLowerCase().includes('aadhaar') || doc.documentType.toLowerCase().includes('aadhar')) {
            kycData.aadharVerified = true;
            kycData.aadharSource = 'digilocker';
          } else if (doc.documentType.toLowerCase().includes('pan')) {
            kycData.panVerified = true;
            kycData.panSource = 'digilocker';
          } else if (doc.documentType.toLowerCase().includes('driving')) {
            kycData.drivingLicenseVerified = true;
            kycData.drivingLicenseSource = 'digilocker';
          } else if (doc.documentType.toLowerCase().includes('passport')) {
            kycData.passportVerified = true;
            kycData.passportSource = 'digilocker';
          }
        } catch (error) {
          console.error(`Error parsing document content for ${doc.id}:`, error);
        }
      }
    }

    return kycData;
  }

  // Check document expiry and cleanup
  async cleanupExpiredDocuments(): Promise<void> {
    const today = new Date().toISOString().split('T')[0]; // Get YYYY-MM-DD format
    
    // Mark expired documents
    await db
      .update(digilockerSharedDocuments)
      .set({
        sharingStatus: "expired",
      })
      .where(and(
        eq(digilockerSharedDocuments.sharedTill, today),
        eq(digilockerSharedDocuments.sharingStatus, "fetched")
      ));

    console.log("✅ Expired DigiLocker documents cleaned up");
  }
}

export const digilockerService = new DigiLockerService();