import { Express } from 'express';
import BBPSService from '../services/bbpsService';
import { digilockerService } from '../services/digilockerService';
import { CashfreeAadhaarService } from '../services/cashfree-aadhaar-service';
import { sandboxKYCService } from '../services/sandbox-kyc-service';
import { storage } from '../storage';

export async function registerBBPSRoutes(app: Express): Promise<void> {
  await BBPSService.initializeBBPSData();
  
  digilockerService.initializeDigiLockerApp().catch((err: any) => {
    console.warn('⚠️ DigiLocker optional service unavailable, using Sandbox API fallback');
  });

  app.post("/api/digilocker/fetch-aadhaar", async (req, res) => {
    try {
      const { aadhaarNumber } = req.body;
      
      if (!aadhaarNumber || aadhaarNumber.length !== 12) {
        return res.status(400).json({ error: "Invalid Aadhaar number" });
      }

      try {
        const otpResponse = await CashfreeAadhaarService.generateOTP(aadhaarNumber);
        
        if (otpResponse.success && otpResponse.ref_id) {
          return res.json({
            success: true,
            source: 'cashfree_okyc',
            requiresOtp: true,
            ref_id: otpResponse.ref_id,
            message: 'OTP sent to Aadhaar-linked mobile. Please verify to fetch details.'
          });
        } else {
          throw new Error(otpResponse.message || 'Failed to generate OTP');
        }
      } catch (cashfreeError: any) {
        console.error('Cashfree OKYC also failed:', cashfreeError);
        return res.status(503).json({
          success: false,
          error: 'All verification services temporarily unavailable. Please enter details manually.',
          fallback: 'manual'
        });
      }
    } catch (error: any) {
      console.error("Error in fetch-aadhaar endpoint:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to fetch Aadhaar details",
        fallback: 'manual'
      });
    }
  });

  app.get("/api/digilocker/widget-config", async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "Authentication required" });
      }
      
      const config = await digilockerService.generateWidgetConfig("handleDigiLockerCallback");
      res.json(config);
    } catch (error) {
      console.error("Error generating DigiLocker widget config:", error);
      res.status(500).json({ error: "Failed to generate widget configuration" });
    }
  });

  app.post("/api/digilocker/initiate-sharing", async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { docTypes = ['aadhaar', 'pan'], flow = 'signin' } = req.body;
      const redirectUri = `${process.env.REPLIT_DEV_DOMAIN ? 'https://' + process.env.REPLIT_DEV_DOMAIN : 'https://fintekpro.com'}/api/digilocker/callback`;

      try {
        const session = await sandboxKYCService.initiateDigiLockerSession(redirectUri, docTypes, flow);
        
        return res.json({ 
          success: true,
          sessionId: session.sessionId,
          authorizationUrl: session.authorizationUrl,
          transactionId: session.transactionId,
          widgetUrl: session.authorizationUrl,
          message: "Please complete the authentication in the DigiLocker window."
        });
      } catch (sandboxErr: any) {
        if (sandboxErr.message?.includes('Test environment') || sandboxErr.message?.includes('does not match')) {
          const mockSessionId = `dlsession_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const mockAuthUrl = `https://digilocker.meripehchaan.gov.in/public/oauth2/1/authorize?client_id=sandbox_test&redirect_uri=${encodeURIComponent(redirectUri)}&state=${mockSessionId}`;
          
          console.log('[DigiLocker] Sandbox test env - using simulated session:', mockSessionId);
          return res.json({
            success: true,
            sessionId: mockSessionId,
            authorizationUrl: mockAuthUrl,
            transactionId: `txn_${Date.now()}`,
            widgetUrl: mockAuthUrl,
            message: "DigiLocker session created. In production, you will be redirected to authenticate with DigiLocker.",
            isSimulated: true
          });
        }
        throw sandboxErr;
      }
    } catch (error: any) {
      console.error("Error initiating DigiLocker sharing:", error);
      res.status(500).json({ 
        success: false,
        message: error.message || "Failed to initiate document sharing. Please try again."
      });
    }
  });

  app.get("/api/digilocker/session/:sessionId/status", async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { sessionId } = req.params;
      
      if (sessionId.startsWith('dlsession_')) {
        return res.json({
          success: true,
          sessionId,
          status: 'created',
          documentsConsented: [],
          createdAt: Date.now(),
          transactionId: `txn_${Date.now()}`,
          isSimulated: true
        });
      }

      const status = await sandboxKYCService.getDigiLockerSessionStatus(sessionId);
      res.json({ success: true, ...status });
    } catch (error: any) {
      console.error("Error checking DigiLocker session status:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post("/api/digilocker/fetch-document", async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { sessionId, documentType } = req.body;
      if (!sessionId || !documentType) {
        return res.status(400).json({ error: "Session ID and document type are required" });
      }

      const document = await sandboxKYCService.fetchDigiLockerDocument(sessionId, documentType);
      res.json({ success: true, document });
    } catch (error: any) {
      console.error("Error fetching DigiLocker document:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  });

  app.post("/api/digilocker/share-document", async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { docId, uri, docType, source, txn, filename, contentType, sharedTill } = req.body;
      
      if (!uri || !docType || !txn) {
        return res.status(400).json({ error: "Missing required document metadata" });
      }

      const metadata = { docId, uri, docType, source, txn, filename, contentType, sharedTill };
      const sharedDocument = await digilockerService.handleDocumentSharing(req.user.id, metadata);
      
      res.json({ success: true, document: sharedDocument });
    } catch (error) {
      console.error("Error handling DigiLocker document sharing:", error);
      res.status(500).json({ error: "Failed to process document sharing" });
    }
  });

  app.get("/api/digilocker/documents", async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const documents = await digilockerService.getUserDocuments(req.user.id);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching DigiLocker documents:", error);
      res.status(500).json({ error: "Failed to fetch documents" });
    }
  });

  app.get("/api/digilocker/documents/:documentId", async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { documentId } = req.params;
      const document = await digilockerService.getDocument(documentId);
      
      if (!document) {
        return res.status(404).json({ error: "Document not found" });
      }

      if (document.userId !== req.user.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      res.json(document);
    } catch (error) {
      console.error("Error fetching DigiLocker document:", error);
      res.status(500).json({ error: "Failed to fetch document" });
    }
  });

  app.post("/api/digilocker/auto-populate-kyc", async (req, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "Authentication required" });
      }

      let kycData;
      let source = 'digilocker';

      try {
        kycData = await digilockerService.autoPopulateKYCFields(req.user.id);
      } catch (digilockerError) {
        console.warn("DigiLocker KYC failed, trying BSE Star fallback:", digilockerError);
        
        const { bseStarKYCService } = await import('../services/bse-star-kyc-service');
        
        const user = await storage.getUserProfile(req.user.id);
        if (!user?.panNumber) {
          throw new Error("PAN number required for KYC verification");
        }

        kycData = await bseStarKYCService.autoPopulateKYC(user.panNumber);
        source = 'bse_star';
      }

      res.json({ 
        success: true, 
        kycData,
        source,
        fallbackUsed: source === 'bse_star'
      });
    } catch (error) {
      console.error("Error auto-populating KYC fields:", error);
      res.status(500).json({ 
        error: "Failed to auto-populate KYC fields",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  console.log("✅ BBPS and DigiLocker routes registered");
}
