export interface SelectionContext {
	query_id: string; // Unique trace
	query_type: "investment" | "tax" | "compliance" | "general";
	user_id?: string;
	risk_level?: "low" | "medium" | "high";
	latency_requirement?: "low" | "high";
	confidence_required?: number; // 0.0 - 1.0 (default 0.8)
	capabilities_required?: string[];
}

export interface SelectionResult {
	selected_model: string;
	confidence_target: number;
	selection_score: number;
	reason: string;
	fallback_triggered: boolean;
	alternative_models?: string[];
}
