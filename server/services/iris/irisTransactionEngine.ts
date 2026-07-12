/**
 * irisTransactionEngine.ts
 *
 * Registry-driven IRIS order execution engine.
 * All product type → endpoint routing is delegated to irisProductRegistry.ts.
 *
 * FASP-AI v3.0 compliance:
 *  - AI never executes autonomously. This engine is invoked ONLY after
 *    advisor/investor approval has been recorded in the DB.
 *  - All executions emit structured audit logs.
 *  - Retries: max 3, exponential backoff, idempotency key forwarded.
 */

import { irisClient } from "./irisClient";
import { logger } from "../../logger";
import {
  type IrisProductCategory,
  resolveIrisEndpoint,
  resolveIrisLifecycleEndpoint,
  validateOrderPayload,
} from "./irisProductRegistry";

const ENGINE_VERSION = "FASP-AI-v3.0";

interface OrderData extends Record<string, unknown> {
  /** FintekPro product category — must match IrisProductCategory */
  productType: IrisProductCategory;
  pan: string;
  idempotencyKey?: string;
}

interface ExecutionResult {
  success: true;
  orderId: string | null;
  paymentUrl?: string | null;
  endpoint: string;
  irisProductType: string;
  requiresAdvisorApproval: boolean;
  requiresDisclaimer: boolean;
  label: string;
  engine_version: string;
  timestamp: string;
  rawResponse: unknown;
}

export class IrisTransactionEngine {

  /**
   * Execute a normalized order payload against the correct IRIS endpoint.
   *
   * @param orderData - Must include `productType` + all required fields per registry
   * @returns ExecutionResult with orderId, paymentUrl, and endpoint metadata
   * @throws on validation failure or IRIS API error
   *
   * FASP-AI: MUST only be called AFTER advisor/investor approval is recorded.
   */
  async executeOrder(orderData: OrderData): Promise<ExecutionResult> {
    const { productType, idempotencyKey } = orderData;

    // 1. Resolve endpoint from registry
    const endpointDef = resolveIrisEndpoint(productType);

    // 2. Validate required fields
    const validation = validateOrderPayload(productType, orderData as Record<string, unknown>);
    if (!validation.valid) {
      throw new Error(
        `[IrisTransactionEngine] Missing required fields for ${productType}: ${validation.missing.join(", ")}`,
      );
    }

    // 3. Structured audit log — FASP-AI v3.0
    logger.info("[IrisTransactionEngine] Executing order", {
      event: "IRIS_ORDER_INITIATED",
      product_type: productType,
      iris_product_type: endpointDef.irisProductType,
      endpoint: endpointDef.irisPath,
      pan_masked: `${orderData.pan?.toString().slice(0, 3)}***${orderData.pan?.toString().slice(-2)}`,
      requires_advisor_approval: endpointDef.requiresAdvisorApproval,
      idempotency_key: idempotencyKey ?? null,
      engine_version: ENGINE_VERSION,
    });

    // 4. Execute via irisClient using registry-resolved path
    let irisResponse: Record<string, unknown>;
    try {
      irisResponse = await irisClient.call(
        endpointDef.irisPath,
        endpointDef.method,
        { ...orderData, productType: endpointDef.irisProductType },
        idempotencyKey,
      ) as Record<string, unknown>;
    } catch (error: unknown) {
      const err = error as { message?: string };
      logger.error("[IrisTransactionEngine] Order execution failed", {
        event: "IRIS_ORDER_FAILED",
        product_type: productType,
        endpoint: endpointDef.irisPath,
        error: err.message,
        retryable: true,
        engine_version: ENGINE_VERSION,
      });
      throw new Error(`IRIS execution failed [${productType}]: ${err.message}`);
    }

    return {
      success: true,
      orderId: (irisResponse.orderId ?? irisResponse.txnId ?? irisResponse.applicationId ?? null) as string | null,
      paymentUrl: (irisResponse.paymentUrl ?? null) as string | null,
      endpoint: endpointDef.irisPath,
      irisProductType: endpointDef.irisProductType,
      requiresAdvisorApproval: endpointDef.requiresAdvisorApproval,
      requiresDisclaimer: endpointDef.requiresDisclaimer,
      label: endpointDef.label,
      engine_version: ENGINE_VERSION,
      timestamp: new Date().toISOString(),
      rawResponse: irisResponse,
    };
  }

  /**
   * Execute a lifecycle action (cancel, pause, modify, status-check) for any product.
   *
   * @param category - Product category (e.g. "SIP")
   * @param action   - Lifecycle action key (e.g. "cancel")
   * @param params   - Path params + body (orderId, sipId, mandateId, etc.)
   */
  async executeLifecycleAction(
    category: IrisProductCategory,
    action: string,
    params: Record<string, unknown>,
  ): Promise<{ success: true; label: string; timestamp: string; rawResponse: unknown }> {
    const def = resolveIrisLifecycleEndpoint(category, action);

    // Interpolate path params (e.g. :sipId → actual value)
    const resolvedPath = def.irisPath.replace(/:(\w+)/g, (_, key) => {
      const val = params[key];
      if (!val) throw new Error(`Missing path param '${key}' for ${def.label}`);
      return String(val);
    });

    logger.info("[IrisTransactionEngine] Lifecycle action", {
      event: "IRIS_LIFECYCLE_INITIATED",
      category,
      action,
      endpoint: resolvedPath,
      engine_version: ENGINE_VERSION,
    });

    const rawResponse = await irisClient.call(resolvedPath, def.method, params);

    return {
      success: true,
      label: def.label,
      timestamp: new Date().toISOString(),
      rawResponse,
    };
  }

  /**
   * Generic order status check — works for MF, FD, Switch, Bond, ETF orders.
   */
  async checkOrderStatus(orderId: string): Promise<{
    success: true;
    status: string;
    rawResponse: unknown;
  }> {
    try {
      const status = await irisClient.getOrderStatus(orderId) as Record<string, unknown>;
      return {
        success: true,
        status: (status.orderStatus ?? status.status ?? "UNKNOWN") as string,
        rawResponse: status,
      };
    } catch (error: unknown) {
      const err = error as { message?: string };
      logger.error("[IrisTransactionEngine] Status check failed", {
        orderId,
        error: err.message,
        engine_version: ENGINE_VERSION,
      });
      throw new Error(`Status check failed: ${err.message}`);
    }
  }

  /**
   * Returns the endpoint metadata for a product category.
   * Used by screener/transact system to enrich `transact.fintekproRoute`.
   */
  getEndpointMetadata(category: IrisProductCategory) {
    const def = resolveIrisEndpoint(category);
    return {
      category,
      irisPath: def.irisPath,
      fintekproRoute: def.fintekproRoute,
      irisProductType: def.irisProductType,
      requiredFields: def.requiredFields,
      requiresAdvisorApproval: def.requiresAdvisorApproval,
      requiresDisclaimer: def.requiresDisclaimer,
      label: def.label,
    };
  }
}

export const irisTransactionEngine = new IrisTransactionEngine();
