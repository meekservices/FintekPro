// Portfolio Rebalance Execute endpoints
// These endpoints should be added to server/routes.ts after the existing rebalance POST endpoint

/*
  // Execute rebalance with one-click functionality
  app.post("/api/portfolios/:portfolioId/rebalance/execute", requireOwnPortfolio, async (req, res) => {
    try {
      const { portfolioId } = req.params;
      const { rebalanceCalculations, portfolioValueBefore } = req.body;
      const userId = (req as any).user.id;
      
      if (!rebalanceCalculations || rebalanceCalculations.length === 0) {
        return apiResponse.badRequest(res, "Rebalance calculations are required");
      }

      // Create rebalance execution record
      const execution = await storage.createRebalanceExecution({
        portfolioId,
        userId,
        status: "executing",
        portfolioValueBefore: portfolioValueBefore?.toString() || "0",
        transactionCount: rebalanceCalculations.length,
        rebalanceDetails: rebalanceCalculations,
        executionNotes: `Automated rebalance execution with ${rebalanceCalculations.length} transactions`
      });

      let successCount = 0;
      let failCount = 0;
      let totalCost = 0;

      // Process each rebalance transaction
      for (const calc of rebalanceCalculations) {
        try {
          // Skip if rebalance amount is negligible (less than ₹1000)
          if (Math.abs(calc.rebalanceAmount) < 1000) {
            continue;
          }

          const transactionCost = Math.abs(calc.rebalanceAmount) * 0.001; // 0.1% transaction cost
          totalCost += transactionCost;

          // Create transaction record
          const transaction = await storage.createRebalanceTransaction({
            rebalanceExecutionId: execution.id,
            portfolioId,
            assetType: calc.assetType,
            action: calc.action,
            amount: Math.abs(calc.rebalanceAmount).toString(),
            transactionCost: transactionCost.toString(),
            status: "executed",
            executedAt: new Date()
          });

          successCount++;
        } catch (error: any) {
          console.error(`Error processing rebalance transaction for ${calc.assetType}:`, error);
          
          // Record failed transaction
          await storage.createRebalanceTransaction({
            rebalanceExecutionId: execution.id,
            portfolioId,
            assetType: calc.assetType,
            action: calc.action,
            amount: Math.abs(calc.rebalanceAmount).toString(),
            status: "failed",
            errorMessage: error.message || "Transaction execution failed"
          });

          failCount++;
        }
      }

      // Update execution status
      const finalStatus = failCount === 0 ? "completed" : (successCount > 0 ? "partially_completed" : "failed");
      await storage.updateRebalanceExecution(execution.id, {
        status: finalStatus,
        successfulTransactions: successCount,
        failedTransactions: failCount,
        totalTransactionCost: totalCost.toString(),
        portfolioValueAfter: portfolioValueBefore?.toString() || "0",
        completedAt: new Date(),
        executionNotes: `Rebalance ${finalStatus}: ${successCount} successful, ${failCount} failed transactions. Total cost: ₹${totalCost.toFixed(2)}`
      });

      res.json({
        executionId: execution.id,
        status: finalStatus,
        successfulTransactions: successCount,
        failedTransactions: failCount,
        totalTransactionCost: totalCost,
        message: `Rebalance ${finalStatus} successfully. ${successCount} transactions processed.`
      });
    } catch (error) {
      console.error("Error executing rebalance:", error);
      return apiResponse.serverError(res, "Failed to execute rebalance");
    }
  });

  // Get rebalance execution history
  app.get("/api/portfolios/:portfolioId/rebalance/history", requireOwnPortfolio, async (req, res) => {
    try {
      const { portfolioId } = req.params;
      const executions = await storage.getRebalanceExecutionsByPortfolio(portfolioId);
      res.json(executions);
    } catch (error) {
      console.error("Error fetching rebalance history:", error);
      return apiResponse.serverError(res, "Failed to fetch rebalance history");
    }
  });

  // Get specific rebalance execution details with transactions
  app.get("/api/rebalance/executions/:executionId", async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const { executionId } = req.params;
      const execution = await storage.getRebalanceExecution(executionId);

      if (!execution) {
        return apiResponse.notFound(res, "Rebalance execution not found");
      }

      // Verify user owns this execution
      if (execution.userId !== req.user.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      const transactions = await storage.getRebalanceTransactionsByExecution(executionId);

      res.json({
        execution,
        transactions
      });
    } catch (error) {
      console.error("Error fetching rebalance execution details:", error);
      return apiResponse.serverError(res, "Failed to fetch execution details");
    }
  });
*/
