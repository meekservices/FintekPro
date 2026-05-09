import { Router } from "express";
import { treasuryService } from "../services/treasury-service";
import { apiResponse } from "../utils/responses";

const router = Router();

// Middleware to ensure user is authenticated
const isAuthenticated = (req: any, res: any, next: any) => {
  if (!req.isAuthenticated()) return apiResponse.unauthorized(res);
  next();
};

// --- Entity Management ---

router.post("/entities", isAuthenticated, async (req, res) => {
  try {
    const entity = await treasuryService.createEntity(req.body);
    return apiResponse.success(res, entity);
  } catch (error) {
    console.error("[TreasuryRoutes] Create entity error:", error);
    return apiResponse.serverError(res);
  }
});

router.get("/entities", isAuthenticated, async (req, res) => {
  try {
    const entities = await treasuryService.getEntities();
    return apiResponse.success(res, entities);
  } catch (error) {
    console.error("[TreasuryRoutes] Get entities error:", error);
    return apiResponse.serverError(res);
  }
});

router.get("/entities/:id", isAuthenticated, async (req, res) => {
  try {
    const entity = await treasuryService.getEntityById(req.params.id);
    if (!entity) return apiResponse.notFound(res, "Entity not found");
    return apiResponse.success(res, entity);
  } catch (error) {
    console.error("[TreasuryRoutes] Get entity error:", error);
    return apiResponse.serverError(res);
  }
});

// --- Bank Account Management ---

router.post("/entities/:id/accounts", isAuthenticated, async (req, res) => {
  try {
    const account = await treasuryService.linkBankAccount(req.params.id, req.body);
    return apiResponse.success(res, account);
  } catch (error) {
    console.error("[TreasuryRoutes] Link account error:", error);
    return apiResponse.serverError(res);
  }
});

router.get("/entities/:id/accounts", isAuthenticated, async (req, res) => {
  try {
    const accounts = await treasuryService.getEntityAccounts(req.params.id);
    return apiResponse.success(res, accounts);
  } catch (error) {
    console.error("[TreasuryRoutes] Get accounts error:", error);
    return apiResponse.serverError(res);
  }
});

export default router;
