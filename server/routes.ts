import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { logger } from "./logger";
import { insertUserSchema, users } from "@shared/schema";
import { setupAuth } from "./auth";
import { eq, or, and, sql, desc, ilike } from "drizzle-orm";
import { db } from "./db";
import { emailService } from "./email-service";
import { whatsappService } from "./whatsapp";
import { smsService } from "./services/sms-service";
import { encryptionService } from "./encryption-service";
import { fileURLToPath } from 'url';
import path from 'path';
import multer from 'multer';
import fs from 'fs';
import { apiResponse } from "./utils/responses";
import { auditLog } from "./middleware/audit-trail";
import { creditRatingsService } from "./services/credit-ratings-service";
import { symbolMappingService } from "./services/symbol-mapping-service";

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // User routes
  app.get("/api/users", async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const allUsers = await storage.getUsers();
    res.json(allUsers);
  });

  // ... (rest of the file)
}
