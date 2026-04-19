import { ModelRegistryEntry } from "../../services/model-registry/types";
import { SelectionContext } from "../../services/model-selection/types";

export class RoutingEngine {
  
  /**
   * Evaluates the $ModelScore = w1(Acc) + w2(Comp) + w3(Lat) + w4(Cost) + w5(Spec)$ equation
   */
  calculateModelRoutingScore(model: ModelRegistryEntry, context: SelectionContext): number {
    // Default weights
    let w1 = 0.25; // Accuracy
    let w2 = 0.25; // Compliance
    let w3 = 0.20; // Latency
    let w4 = 0.15; // Cost
    let w5 = 0.15; // Specialization
    
    // Dynamic Re-weighting based on Query context
    if (context.query_type === "compliance" || context.query_type === "tax") {
      w2 = 0.40; // Massive Compliance Focus
      w1 = 0.30; // High Accuracy Focus
      w3 = 0.10; // Relax latency
      w4 = 0.05; // Relax cost
      w5 = 0.15; // Keep specialization
    } else if (context.latency_requirement === "low") {
      w3 = 0.50; // Priority zero: speed
      w2 = 0.20;
      w1 = 0.20;
      w4 = 0.05;
      w5 = 0.05;
    }

    // Normalizing dynamic indices 
    const normalizedLatencyScore = this.normalizeLatency(model.latency_ms);
    const normalizedCostScore = this.normalizeCost(model.cost_per_call);
    const specializationScore = this.getSpecializationScore(model, context.query_type);

    const score = 
      (model.avg_score * w1) + 
      (model.compliance_score * w2) +
      (normalizedLatencyScore * w3) +
      (normalizedCostScore * w4) +
      (specializationScore * w5);

    return Math.round(score);
  }

  // Converts ms latency to a 0-100 score where lower is better
  private normalizeLatency(latencyMs: number): number {
    if (latencyMs <= 100) return 100;
    if (latencyMs >= 5000) return 0;
    return 100 - ((latencyMs / 5000) * 100);
  }

  // Converts relative cost to a 0-100 score where lower is better
  private normalizeCost(cost: number): number {
    // Assuming highly expensive call = $0.10
    if (cost <= 0.001) return 100; // Super cheap
    if (cost >= 0.10) return 0; // Huge penalty
    return 100 - ((cost / 0.10) * 100);
  }

  // Extract contextual domain match mapped to registry flags
  private getSpecializationScore(model: ModelRegistryEntry, queryType: string): number {
    if (!model.specialization_weights) return 50;
    if (queryType === "investment" && model.specialization_weights.investment) return model.specialization_weights.investment * 100;
    if (queryType === "tax" && model.specialization_weights.tax) return model.specialization_weights.tax * 100;
    if (queryType === "compliance" && model.specialization_weights.compliance) return model.specialization_weights.compliance * 100;
    return 50; // default unknown
  }
}

export const aiRoutingEngine = new RoutingEngine();
