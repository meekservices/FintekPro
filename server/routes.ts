import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";

// Agent Portal Routes
import agentTrackerRouter from "./routes/agent-tracker";
import agentRevenueRouter from "./routes/agent-revenue-routes";
import agentBasketsRouter from "./routes/agent-baskets";
import agentSipHealthRouter from "./routes/agent-sip-health";
import agentPortfolioDriftRouter from "./routes/agent-portfolio-drift";
import agentClientOrdersRouter from "./routes/agent-client-orders";
import agentMarketAlertsRouter from "./routes/agent-market-alerts";

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  // Agent Portal API endpoints
  app.use("/api/agent", agentTrackerRouter);
  app.use("/api/agent", agentRevenueRouter);
  app.use("/api/agent", agentBasketsRouter);
  app.use("/api/agent", agentSipHealthRouter);
  app.use("/api/agent", agentPortfolioDriftRouter);
  app.use("/api/agent", agentClientOrdersRouter);
  app.use("/api/agent", agentMarketAlertsRouter);

  // Fallback for non-existent API routes
  app.use("/api/*", (req, res) => {
    res.status(404).json({ error: "Not Found" });
  });

  const httpServer = createServer(app);
  return httpServer;
}
