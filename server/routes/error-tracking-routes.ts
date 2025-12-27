import { Router, Request, Response } from "express";
import { errorTrackingService } from "../services/error-tracking-service";
import { errorIngestionSchema } from "../../shared/schema";
import { z } from "zod";

const router = Router();

router.post("/ingest", async (req: Request, res: Response) => {
  try {
    const validatedData = errorIngestionSchema.parse(req.body);
    
    const ipAddress = req.ip || req.socket.remoteAddress || undefined;
    
    const error = await errorTrackingService.ingestError(validatedData, ipAddress);
    
    res.status(201).json({
      success: true,
      errorId: error.id,
      sentryEventId: error.sentryEventId
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ 
        success: false,
        error: "Validation error", 
        details: err.errors 
      });
    } else {
      console.error("Error ingesting error log:", err);
      res.status(500).json({ 
        success: false,
        error: "Failed to ingest error" 
      });
    }
  }
});

router.get("/", async (req: Request, res: Response) => {
  try {
    const { 
      severity, status, module, errorCode, 
      dateFrom, dateTo, clientId, agentId, 
      search, limit, offset 
    } = req.query;
    
    const result = await errorTrackingService.getErrors({
      severity: severity as string,
      status: status as string,
      module: module as string,
      errorCode: errorCode as string,
      dateFrom: dateFrom ? new Date(dateFrom as string) : undefined,
      dateTo: dateTo ? new Date(dateTo as string) : undefined,
      clientId: clientId as string,
      agentId: agentId as string,
      search: search as string,
      limit: limit ? parseInt(limit as string) : undefined,
      offset: offset ? parseInt(offset as string) : undefined,
    });
    
    res.json(result);
  } catch (err) {
    console.error("Error fetching errors:", err);
    res.status(500).json({ error: "Failed to fetch errors" });
  }
});

router.get("/metrics", async (req: Request, res: Response) => {
  try {
    const { dateFrom, dateTo } = req.query;
    
    const metrics = await errorTrackingService.getMetrics(
      dateFrom ? new Date(dateFrom as string) : undefined,
      dateTo ? new Date(dateTo as string) : undefined
    );
    
    res.json(metrics);
  } catch (err) {
    console.error("Error fetching error metrics:", err);
    res.status(500).json({ error: "Failed to fetch metrics" });
  }
});

router.get("/critical", async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const errors = await errorTrackingService.getRecentCriticalErrors(limit);
    res.json(errors);
  } catch (err) {
    console.error("Error fetching critical errors:", err);
    res.status(500).json({ error: "Failed to fetch critical errors" });
  }
});

router.get("/:id", async (req: Request, res: Response) => {
  try {
    const error = await errorTrackingService.getErrorById(req.params.id);
    
    if (!error) {
      return res.status(404).json({ error: "Error not found" });
    }
    
    res.json(error);
  } catch (err) {
    console.error("Error fetching error details:", err);
    res.status(500).json({ error: "Failed to fetch error details" });
  }
});

router.patch("/:id/status", async (req: Request, res: Response) => {
  try {
    const { status, resolutionNote } = req.body;
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    if (!['open', 'acknowledged', 'in_progress', 'resolved', 'ignored'].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    
    const updated = await errorTrackingService.updateErrorStatus(
      req.params.id,
      status,
      userId,
      resolutionNote
    );
    
    if (!updated) {
      return res.status(404).json({ error: "Error not found" });
    }
    
    res.json(updated);
  } catch (err) {
    console.error("Error updating error status:", err);
    res.status(500).json({ error: "Failed to update error status" });
  }
});

export default router;
