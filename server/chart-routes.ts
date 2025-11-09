import type { Express } from "express";
import { chartService } from "./chart-service";
import { db } from "./db";
import { chartConfigurations } from "@shared/schema";
import { insertChartConfigurationSchema } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { logger } from "./logger";
import { v4 as uuidv4 } from 'uuid';

/**
 * Register Chart API routes for Interactive Charts feature
 * Handles historical data fetching, multi-symbol comparison, and chart configuration management
 */
export function registerChartRoutes(app: Express) {
  
  // Get historical data for a single symbol with custom date range
  app.get("/api/charts/:symbol/historical", async (req, res) => {
    try {
      const { symbol } = req.params;
      const { rangeType = '1Y', startDate, endDate, indicators } = req.query as {
        rangeType?: string;
        startDate?: string;
        endDate?: string;
        indicators?: string;
      };

      logger.info('[Charts API] Fetching historical data', {
        symbol,
        rangeType,
        customRange: startDate && endDate,
      });

      // Fetch historical data
      const historicalData = await chartService.fetchHistoricalData(
        symbol,
        rangeType,
        startDate,
        endDate
      );

      // Calculate indicators if requested
      let technicalIndicators = {};
      if (indicators) {
        const indicatorSettings = JSON.parse(indicators);
        technicalIndicators = chartService.calculateIndicators(historicalData, indicatorSettings);
      }

      res.json({
        symbol,
        data: historicalData,
        indicators: technicalIndicators,
        dataPoints: historicalData.length,
        rangeType,
        startDate: historicalData[0]?.date,
        endDate: historicalData[historicalData.length - 1]?.date,
      });
    } catch (error) {
      logger.error('[Charts API] Error fetching historical data', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({
        error: 'Failed to fetch historical data',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Compare multiple symbols with normalized data and performance metrics
  app.post("/api/charts/compare", async (req, res) => {
    try {
      const { symbols, rangeType = '1Y', startDate, endDate } = req.body;

      // Validate symbols array
      if (!Array.isArray(symbols) || symbols.length === 0) {
        return res.status(400).json({
          error: 'Invalid request',
          message: 'Symbols array is required and must not be empty',
        });
      }

      if (symbols.length > 5) {
        return res.status(400).json({
          error: 'Too many symbols',
          message: 'Maximum 5 symbols allowed for comparison',
        });
      }

      logger.info('[Charts API] Comparing symbols', {
        symbols,
        rangeType,
        count: symbols.length,
      });

      // Fetch and compare data
      const comparisonResult = await chartService.compareSymbols(
        symbols,
        rangeType,
        startDate,
        endDate
      );

      res.json({
        data: comparisonResult.comparison,
        symbols,
        rangeType,
        metrics: comparisonResult.metrics,
        correlation: comparisonResult.correlation,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('[Charts API] Error comparing symbols', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({
        error: 'Failed to compare symbols',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Get all chart configurations for the authenticated user
  app.get("/api/charts/configurations", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User ID not found' });
      }

      logger.info('[Charts API] Fetching user chart configurations', { userId });

      const configs = await db.query.chartConfigurations.findMany({
        where: eq(chartConfigurations.userId, userId),
        orderBy: [desc(chartConfigurations.updatedAt)],
      });

      res.json({
        configurations: configs,
        count: configs.length,
      });
    } catch (error) {
      logger.error('[Charts API] Error fetching configurations', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({
        error: 'Failed to fetch chart configurations',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Create a new chart configuration
  app.post("/api/charts/configurations", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User ID not found' });
      }

      // Validate request body
      const validationResult = insertChartConfigurationSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          error: 'Validation error',
          details: validationResult.error.errors,
        });
      }

      const data = validationResult.data;

      // Generate share token if sharing is enabled
      const shareToken = data.isDiscoverable ? uuidv4() : null;

      logger.info('[Charts API] Creating chart configuration', {
        userId,
        name: data.name,
        symbolCount: data.symbols.length,
      });

      const [newConfig] = await db.insert(chartConfigurations).values({
        ...data,
        userId,
        shareToken,
      }).returning();

      res.status(201).json(newConfig);
    } catch (error) {
      logger.error('[Charts API] Error creating configuration', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({
        error: 'Failed to create chart configuration',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Update an existing chart configuration
  app.put("/api/charts/configurations/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User ID not found' });
      }

      const { id } = req.params;

      // Check ownership
      const existing = await db.query.chartConfigurations.findFirst({
        where: and(
          eq(chartConfigurations.id, id),
          eq(chartConfigurations.userId, userId)
        ),
      });

      if (!existing) {
        return res.status(404).json({ error: 'Chart configuration not found' });
      }

      // For updates, accept partial data
      const data = req.body;
      
      // Basic validation - ensure at least one field is being updated
      if (Object.keys(data).length === 0) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'At least one field must be provided for update',
        });
      }

      logger.info('[Charts API] Updating chart configuration', {
        userId,
        configId: id,
      });

      const [updated] = await db
        .update(chartConfigurations)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(chartConfigurations.id, id))
        .returning();

      res.json(updated);
    } catch (error) {
      logger.error('[Charts API] Error updating configuration', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({
        error: 'Failed to update chart configuration',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Delete a chart configuration
  app.delete("/api/charts/configurations/:id", async (req, res) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'User ID not found' });
      }

      const { id } = req.params;

      // Check ownership
      const existing = await db.query.chartConfigurations.findFirst({
        where: and(
          eq(chartConfigurations.id, id),
          eq(chartConfigurations.userId, userId)
        ),
      });

      if (!existing) {
        return res.status(404).json({ error: 'Chart configuration not found' });
      }

      logger.info('[Charts API] Deleting chart configuration', {
        userId,
        configId: id,
      });

      await db.delete(chartConfigurations).where(eq(chartConfigurations.id, id));

      res.json({ success: true, message: 'Chart configuration deleted' });
    } catch (error) {
      logger.error('[Charts API] Error deleting configuration', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({
        error: 'Failed to delete chart configuration',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // View shared chart configuration (public access via share token)
  app.get("/api/charts/shared/:shareToken", async (req, res) => {
    try {
      const { shareToken } = req.params;

      logger.info('[Charts API] Fetching shared chart configuration', { shareToken });

      const config = await db.query.chartConfigurations.findFirst({
        where: eq(chartConfigurations.shareToken, shareToken),
      });

      if (!config) {
        return res.status(404).json({ error: 'Shared chart not found or not accessible' });
      }

      // Increment view count
      await db
        .update(chartConfigurations)
        .set({
          viewCount: (config.viewCount || 0) + 1,
        })
        .where(eq(chartConfigurations.id, config.id));

      // Don't expose userId in shared view
      const { userId: _userId, ...publicConfig } = config;

      res.json(publicConfig);
    } catch (error) {
      logger.error('[Charts API] Error fetching shared configuration', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({
        error: 'Failed to fetch shared chart',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  logger.info('[Charts API] Chart routes registered successfully');
}
