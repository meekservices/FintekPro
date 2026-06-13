// @ts-nocheck
import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import crypto from "crypto";
import { errorTrackingService } from "./error-tracking-service";

// the newest OpenAI model is "gpt-4o" which was released August 7, 2025. do not change this unless explicitly requested by the user

// OpenAI — DISABLED. We use Gemini (free tier) as primary.
// Groq / Cerebras / Cloudflare still import OpenAI as an OpenAI-compatible client
// (different base URLs), so the import is kept above but the OpenAI clients are null.
const openaiIntegrations = null;
const openaiDirect = null;

// Groq — free tier (14,400 req/day). Get key: https://console.groq.com/keys
const groq = process.env.GROQ_API_KEY
	? new OpenAI({
			baseURL: "https://api.groq.com/openai/v1",
			apiKey: process.env.GROQ_API_KEY,
		})
	: null;
const GROQ_DEFAULT_MODEL = "llama-3.3-70b-versatile";

// Gemini (Google AI) — cheap + reliable. Get key: https://aistudio.google.com/apikey
const geminiApiKey = process.env.GEMINI_API_KEY;
const gemini = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;

// Cerebras — free tier, world's fastest inference (2000+ tok/sec). Get key: https://cloud.cerebras.ai
const cerebras = process.env.CEREBRAS_API_KEY
	? new OpenAI({
			baseURL: "https://api.cerebras.ai/v1",
			apiKey: process.env.CEREBRAS_API_KEY,
		})
	: null;
const CEREBRAS_DEFAULT_MODEL = "gpt-oss-120b";

// Cloudflare Workers AI — free forever on the free plan. Get key: https://dash.cloudflare.com
// Uses OpenAI-compatible endpoint via the AI Gateway
const cloudflareAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;
const cloudflareApiKey = process.env.CLOUDFLARE_API_KEY;
const cloudflare =
	cloudflareAccountId && cloudflareApiKey
		? new OpenAI({
				baseURL: `https://api.cloudflare.com/client/v4/accounts/${cloudflareAccountId}/ai/v1`,
				apiKey: cloudflareApiKey,
			})
		: null;
const CLOUDFLARE_DEFAULT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

// Anthropic Claude — best instruction-following. Get key: https://console.anthropic.com
// Uses OpenAI-compatible endpoint via a thin wrapper if ANTHROPIC_API_KEY is set
const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

export type AIProvider =
	| "openai"
	| "openai-direct"
	| "gemini"
	| "groq"
	| "cerebras"
	| "cloudflare"
	| "anthropic";
export type AIModel =
	// ── OpenAI ──────────────────────────────────────────────────────────────
	| "gpt-4o" // Best reasoning (quota-heavy)
	| "gpt-4o-mini" // 30x cheaper than gpt-4o, ~95% quality
	| "o4-mini" // Reasoning model — best for complex analysis
	// ── Gemini (Google) ─────────────────────────────────────────────────────
	| "gemini-2.5-flash" // Stable GA — fast + multimodal, free 15 rpm
	| "gemini-2.5-flash-lite" // Ultra-cheap fast fallback (2.5 family)
	| "gemini-2.0-flash" // Full Flash — still available
	// ── Groq (free tier, OpenAI-compatible) ─────────────────────────────────
	| "llama-3.3-70b-versatile" // Best Groq model — free
	| "llama-3.1-8b-instant" // Ultra-fast bulk processing — free
	| "qwen/qwen3-32b" // Qwen3 32B on Groq — replaces DeepSeek R1 (free)
	| "meta-llama/llama-4-scout-17b-16e-instruct" // Llama 4 Scout on Groq — free
	| "gemma2-9b-it" // Google Gemma 2 on Groq — free
	| "compound-beta" // Groq auto-router — picks best model
	// ── Cerebras (free tier, fastest inference) ────────────────────────────
	| "gpt-oss-120b" // OpenAI OSS 120B on Cerebras — free (fastest)
	| "zai-glm-4.7" // ZAI GLM 4.7 on Cerebras — free
	// ── Cloudflare Workers AI (free forever) ────────────────────────────────
	| "@cf/meta/llama-3.3-70b-instruct-fp8-fast" // Llama 3.3 70B on Cloudflare — free
	| "@cf/meta/llama-3.1-8b-instruct" // Llama 3.1 8B on Cloudflare — free
	// ── Anthropic ───────────────────────────────────────────────────────────
	| "claude-3-5-haiku-20241022" // Best instruction-following, $0.80/1M tok
	| "claude-3-5-sonnet-20241022"; // Best overall Anthropic model

export enum AICapability {
	SUPERIOR = "superior", // Complex reasoning, strategy — uses best available
	STANDARD = "standard", // General advice, JSON extraction
	OPTIMIZED = "optimized", // Speed + bulk processing
}

const isComplexModel = (model: string) =>
	[
		"gpt-4o",
		"o4-mini",
		"llama-3.3-70b-versatile",
		"deepseek-r1-distill-llama-70b",
		"gemini-2.5-flash",
		"claude-3-5-sonnet-20241022",
	].includes(model);

interface ChatMessage {
	role: "system" | "user" | "assistant";
	content: string;
}

interface AIServiceOptions {
	provider?: AIProvider;
	model?: AIModel;
	temperature?: number;
	maxTokens?: number;
	stream?: boolean;
	capability?: AICapability;
	promptName?: string;
	userId?: string;
	feature?: string;
	json?: boolean;
}

export interface AIUsageMetrics {
	provider: AIProvider;
	model: string;
	promptTokens: number;
	completionTokens: number;
	totalTokens: number;
	requestId: string;
	timestamp: Date;
}

export class AIService {
	private usageMetrics: AIUsageMetrics[] = [];
	private _defaultProvider: AIProvider = "groq";
	private _defaultModel: AIModel = "llama-3.3-70b-versatile";

	private providerStatus: Record<
		AIProvider,
		{ healthy: boolean; lastErrorTime: number }
	> = {
		openai: { healthy: true, lastErrorTime: 0 },
		"openai-direct": { healthy: true, lastErrorTime: 0 },
		gemini: { healthy: true, lastErrorTime: 0 },
		groq: { healthy: true, lastErrorTime: 0 },
		cerebras: { healthy: true, lastErrorTime: 0 },
		cloudflare: { healthy: true, lastErrorTime: 0 },
		anthropic: { healthy: true, lastErrorTime: 0 },
	};
	private COOL_DOWN_MS = 5 * 60 * 1000; // 5 minutes cool-down for 429s

	private isProviderHealthy(provider: AIProvider): boolean {
		const status = this.providerStatus[provider];
		if (status.healthy) return true;
		if (Date.now() - status.lastErrorTime > this.COOL_DOWN_MS) {
			status.healthy = true;
			return true;
		}
		return false;
	}

	private markProviderUnhealthy(provider: AIProvider) {
		console.warn(
			`[AIService] Marking ${provider} as unhealthy (cool-down starting)`,
		);
		this.providerStatus[provider] = {
			healthy: false,
			lastErrorTime: Date.now(),
		};
	}

	setDefaultProvider(provider: AIProvider) {
		this._defaultProvider = provider;
		const defaultModels: Partial<Record<AIProvider, AIModel>> = {
			gemini: "gemini-2.5-flash",
			groq: "llama-3.3-70b-versatile",
			cerebras: "gpt-oss-120b",
			cloudflare: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
			anthropic: "claude-3-5-haiku-20241022",
			openai: "gpt-4o-mini",
			"openai-direct": "gpt-4o",
		};
		this._defaultModel = defaultModels[provider] ?? "llama-3.3-70b-versatile";
		console.log(
			`[AIService] Default provider switched to: ${provider} (model: ${this._defaultModel})`,
		);
	}

	getDefaultProvider(): { provider: AIProvider; model: AIModel } {
		return { provider: this._defaultProvider, model: this._defaultModel };
	}

	/**
	 * Log prompt usage to audit table
	 */
	private async logPromptUsage(
		promptName: string,
		version: string,
		responseContent: string,
		userId?: string,
		feature?: string,
	): Promise<void> {
		try {
			const { db } = await import("../db");
			const { aiPromptVersions } = await import("@shared/schema");
			const hash = crypto
				.createHash("sha256")
				.update(responseContent.slice(0, 500))
				.digest("hex");
			await db.insert(aiPromptVersions).values({
				promptName,
				version,
				userId,
				feature,
				responsePreviewHash: hash,
			});
		} catch (err: any) {
			console.warn("[AIService] Failed to log prompt usage:", err.message);
		}
	}

	/**
	 * Convenience method for single prompt completion
	 */
	async generateResponse(
		prompt: string,
		options: AIServiceOptions = {},
	): Promise<string> {
		const messages: ChatMessage[] = [{ role: "user", content: prompt }];
		const result = await this.chat(messages, options);
		return result.content;
	}

	/**
	 * Check for model availability
	 */
	isGpt52Available(): boolean {
		return false; // OpenAI disabled — using Gemini free tier
	}

	/**
	 * Chat completion with automatic fallback
	 * the newest OpenAI model is "gpt-4o" which was released August 7, 2025. do not change this unless explicitly requested by the user
	 */
	async chat(
		messages: ChatMessage[],
		options: AIServiceOptions = {},
	): Promise<{ content: string; usage: AIUsageMetrics }> {
		const {
			provider: defaultProvider = this._defaultProvider,
			model: defaultModel = this._defaultModel,
			temperature = 0.7,
			maxTokens = 8192,
			stream = false,
			capability,
			promptName,
			userId,
			feature,
		} = options;

		// Capability-based model selection
		let initialProvider = defaultProvider;
		let initialModel = defaultModel;

		// Capability → best available model selection
		if (capability === AICapability.SUPERIOR) {
			// Best reasoning — prefer Groq (free), fall to Gemini (free)
			if (groq) {
				initialProvider = "groq";
				initialModel = "llama-3.3-70b-versatile";
			} else {
				initialProvider = "gemini";
				initialModel = "gemini-2.5-flash";
			}
		} else if (capability === AICapability.OPTIMIZED) {
			// Speed + bulk — llama instant on Groq
			initialProvider = "groq";
			initialModel = "llama-3.1-8b-instant";
		} else if (capability === AICapability.STANDARD) {
			// General use — Gemini 2.5 flash is best free option
			initialProvider = gemini ? "gemini" : "groq";
			initialModel = gemini ? "gemini-2.5-flash" : "llama-3.3-70b-versatile";
		}

		// 8-step fallback chain — free providers only (OpenAI removed)
		// Providers without env vars are skipped silently (not as ERRORs)
		const fallbackChain: { provider: AIProvider; model: AIModel }[] = [
			// Groq — free tier, fast
			{ provider: "groq", model: "llama-3.3-70b-versatile" },
			{ provider: "groq", model: "qwen/qwen3-32b" },
			{ provider: "groq", model: "llama-3.1-8b-instant" },
			// Cerebras — free tier, world's fastest inference
			{ provider: "cerebras", model: "gpt-oss-120b" },
			{ provider: "cerebras", model: "zai-glm-4.7" },
			// Gemini — primary free provider (GEMINI_API_KEY required)
			{ provider: "gemini", model: "gemini-2.5-flash" },
			{ provider: "gemini", model: "gemini-2.5-flash-lite" },
			// Cloudflare Workers AI — free forever (only if configured)
			{
				provider: "cloudflare",
				model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
			},
		];

		// Put the selected initial provider first, dedupe the rest
		const finalChain = [
			{ provider: initialProvider, model: initialModel },
			...fallbackChain.filter(
				(p) => !(p.provider === initialProvider && p.model === initialModel),
			),
		];

		let lastError: Error | null = null;
		const MAX_RETRIES = 1; // Reduced since we have fallback

		for (const { provider, model } of finalChain) {
			if (!this.isProviderHealthy(provider)) {
				console.log(`[AIService] Skipping unhealthy provider: ${provider}`);
				continue;
			}

			let attempt = 0;
			while (attempt <= MAX_RETRIES) {
				try {
					console.log(
						`[AIService] Attempting chat with ${provider} (${model}) [Attempt ${attempt + 1}]...`,
					);

					let result: { content: string; usage: AIUsageMetrics };

					if (provider === "openai" || provider === "openai-direct") {
						result = await this.chatWithOpenAI(
							messages,
							model,
							temperature,
							maxTokens,
							stream,
						);
					} else if (provider === "groq" && groq) {
						result = await this.chatWithGroq(
							messages,
							model,
							temperature,
							maxTokens,
						);
					} else if (provider === "cerebras" && cerebras) {
						result = await this.chatWithCerebras(
							messages,
							model,
							temperature,
							maxTokens,
						);
					} else if (provider === "cloudflare" && cloudflare) {
						result = await this.chatWithCloudflare(
							messages,
							model,
							temperature,
							maxTokens,
						);
					} else if (provider === "gemini" && gemini) {
						result = await this.chatWithGemini(
							messages,
							model,
							temperature,
							maxTokens,
							options,
						);
					} else if (provider === "anthropic" && anthropicApiKey) {
						result = await this.chatWithAnthropic(
							messages,
							model,
							temperature,
							maxTokens,
						);
					} else {
						// Provider not configured — skip silently, try next in chain
						console.log(
							`[AIService] Provider '${provider}' not configured, skipping`,
						);
						break;
					}

					if (promptName) {
						try {
							const { ALL_PROMPTS } = await import("../ai/prompts/registry");
							const prompt = ALL_PROMPTS[promptName];
							if (prompt) {
								this.logPromptUsage(
									promptName,
									prompt.version,
									result.content,
									userId,
									feature,
								).catch(() => {});
							}
						} catch {
							// Registry not available; skip logging
						}
					}

					return result;
				} catch (error: any) {
					lastError = error;
					const status =
						error.status ||
						error.statusCode ||
						(error.response ? error.response.status : "N/A");

					console.error(
						`[AIService] ❌ ${provider} (${model}) failed [Status: ${status}]: ${error.message}`,
					);

					// Log each failure to error tracker
					errorTrackingService
						.ingestError({
							source: "AIService",
							severity: "medium",
							errorCode: `AI_PROVIDER_ERROR_${provider.toUpperCase()}`,
							message: `AI provider ${provider} (${model}) failed: ${error.message}`,
							stack: error.stack,
							context: {
								module: "AIService",
								metadata: {
									provider,
									model,
									status,
									attempt,
									capability,
									feature,
									options,
								},
							},
						})
						.catch(() => {});

					const is429 =
						error.status === 429 ||
						error.message?.includes("429") ||
						error.message?.toLowerCase().includes("quota") ||
						error.message?.toLowerCase().includes("rate limit");

					if (is429) {
						if (attempt < MAX_RETRIES) {
							const delay = (attempt + 1) * 3000;
							console.warn(
								`[AIService] ⏳ Rate limit (429) hit for ${provider}. Retrying in ${delay}ms...`,
							);
							await new Promise((resolve) => setTimeout(resolve, delay));
							attempt++;
							continue;
						}
						console.error(
							`[AIService] ⚠️ Max retries reached for ${provider} after 429. Marking unhealthy.`,
						);
						this.markProviderUnhealthy(provider);
						break; // Move to next provider
					}

					console.error(
						`[AIService] ${provider} failed (non-retryable or max retries):`,
						error.message,
					);
					break; // Move to next provider in chain
				}
			}
		}

		const errorMessage = `AI Service: All providers failed. Last error: ${lastError?.message}`;

		// Log critical failure to error tracking
		await errorTrackingService
			.ingestError({
				source: "server",
				severity: "high",
				errorCode: "AI_SERVICE_ALL_FAILED",
				message: errorMessage,
				stack: lastError?.stack,
				context: {
					module: "ai-service",
					userId,
					metadata: {
						options,
						initialProvider,
						initialModel,
						fallbackChainSize: fallbackChain.length,
					},
				},
			})
			.catch((err) =>
				console.error(
					"[AIService] Failed to log error to ErrorTrackingService:",
					err,
				),
			);

		throw new Error(errorMessage);
	}

	/**
	 * Streaming chat completion
	 * the newest OpenAI model is "gpt-4o" which was released August 7, 2025. do not change this unless explicitly requested by the user
	 */
	async streamChat(
		messages: ChatMessage[],
		onChunk: (chunk: string) => void,
		options: AIServiceOptions = {},
	): Promise<{ content: string; usage: AIUsageMetrics }> {
		const {
			provider: defaultProvider = this._defaultProvider,
			model: defaultModel = this._defaultModel,
			temperature = 0.7,
			maxTokens = 8192,
			capability,
		} = options;

		let initialProvider = defaultProvider;
		let initialModel = defaultModel;

		if (capability === AICapability.SUPERIOR) {
			if (groq) {
				initialProvider = "groq";
				initialModel = "llama-3.3-70b-versatile";
			} else {
				initialProvider = "gemini";
				initialModel = "gemini-2.5-flash";
			}
		} else if (capability === AICapability.OPTIMIZED) {
			initialProvider = "groq";
			initialModel = "llama-3.1-8b-instant";
		} else if (capability === AICapability.STANDARD) {
			initialProvider = gemini ? "gemini" : "groq";
			initialModel = gemini ? "gemini-2.5-flash" : "llama-3.3-70b-versatile";
		}

		const fallbackChain: { provider: AIProvider; model: AIModel }[] = [
			{ provider: "groq", model: "llama-3.3-70b-versatile" },
			{ provider: "groq", model: "qwen/qwen3-32b" },
			{ provider: "groq", model: "llama-3.1-8b-instant" },
			{ provider: "cerebras", model: "gpt-oss-120b" },
			{ provider: "cerebras", model: "zai-glm-4.7" },
			{
				provider: "cloudflare",
				model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
			},
			{ provider: "gemini", model: "gemini-2.5-flash" },
			{ provider: "gemini", model: "gemini-2.5-flash-lite" },
		];

		const finalChain = [
			{ provider: initialProvider, model: initialModel },
			...fallbackChain.filter(
				(p) => !(p.provider === initialProvider && p.model === initialModel),
			),
		];

		let lastError: Error | null = null;

		for (const { provider, model } of finalChain) {
			if (!this.isProviderHealthy(provider)) continue;

			try {
				console.log(
					`[AIService] Attempting stream with ${provider} (${model})...`,
				);

				if (provider === "openai" || provider === "openai-direct") {
					return await this.streamOpenAI(
						messages,
						model,
						temperature,
						maxTokens,
						onChunk,
					);
				}
				if (provider === "gemini" && gemini) {
					return await this.streamGemini(
						messages,
						model,
						temperature,
						maxTokens,
						onChunk,
					);
				}
				if (provider === "groq" && groq) {
					return await this.streamOpenAI(
						messages,
						model,
						temperature,
						maxTokens,
						onChunk,
					);
				}
				if (provider === "cerebras" && cerebras) {
					return await this.streamOpenAI(
						messages,
						model,
						temperature,
						maxTokens,
						onChunk,
					);
				}
				if (provider === "cloudflare" && cloudflare) {
					return await this.streamOpenAI(
						messages,
						model,
						temperature,
						maxTokens,
						onChunk,
					);
				}
				throw new Error(`Provider ${provider} not available for streaming`);
			} catch (error: any) {
				lastError = error;
				console.error(
					`[AIService] Streaming ${provider} failed:`,
					error.message,
				);
				if (error.status === 429 || error.message?.includes("429")) {
					this.markProviderUnhealthy(provider);
				}
			}
		}

		throw new Error(
			`AI Streaming Service: All providers failed. Last error: ${lastError?.message}`,
		);
	}

	/**
	 * OpenAI chat completion (via Replit AI Integrations - up to gpt-4o.1)
	 */
	private async chatWithOpenAI(
		messages: ChatMessage[],
		model: string,
		temperature: number,
		maxTokens: number,
		stream: boolean,
	): Promise<{ content: string; usage: AIUsageMetrics }> {
		const isO1 = model.startsWith("o1-");
		const client = openaiDirect || openaiIntegrations;
		if (!client) {
			throw new Error(
				"OpenAI provider not configured — set OPENAI_API_KEY or AI_INTEGRATIONS_OPENAI_API_KEY",
			);
		}
		const response = await client.chat.completions.create({
			model,
			messages,
			temperature: isO1 ? undefined : temperature,
			max_completion_tokens: isO1 ? maxTokens : undefined,
			max_tokens: !isO1 ? maxTokens : undefined,
			stream: false,
		});

		// Ensure content is always a string
		let content = response.choices[0]?.message?.content || "";
		if (typeof content !== "string") {
			console.warn(
				"[AI Service] OpenAI returned non-string content, converting to JSON:",
				typeof content,
			);
			content = JSON.stringify(content);
		}
		const usage: AIUsageMetrics = {
			provider: openaiDirect ? "openai-direct" : "openai",
			model,
			promptTokens: response.usage?.prompt_tokens || 0,
			completionTokens: response.usage?.completion_tokens || 0,
			totalTokens: response.usage?.total_tokens || 0,
			requestId: response.id,
			timestamp: new Date(),
		};

		this.usageMetrics.push(usage);
		return { content, usage };
	}

	/**
	 * Groq chat completion — free-tier, OpenAI-compatible (Llama 3.3 70B)
	 * Requires GROQ_API_KEY. Get a free key at https://console.groq.com/keys
	 * Free tier: 14,400 req/day, 6,000 tokens/min, no credit card required
	 */
	private async chatWithGroq(
		messages: ChatMessage[],
		model: string,
		temperature: number,
		maxTokens: number,
	): Promise<{ content: string; usage: AIUsageMetrics }> {
		if (!groq) {
			throw new Error(
				"Groq not configured — set GROQ_API_KEY environment variable",
			);
		}
		const groqModel = model || GROQ_DEFAULT_MODEL; // pass any Groq model as-is
		const response = await groq.chat.completions.create({
			model: groqModel,
			messages,
			temperature,
			max_tokens: maxTokens,
			stream: false,
		});
		const content = response.choices[0]?.message?.content || "";
		const usage: AIUsageMetrics = {
			provider: "groq",
			model: groqModel,
			promptTokens: response.usage?.prompt_tokens || 0,
			completionTokens: response.usage?.completion_tokens || 0,
			totalTokens: response.usage?.total_tokens || 0,
			requestId: response.id,
			timestamp: new Date(),
		};
		this.usageMetrics.push(usage);
		return { content, usage };
	}

	/**
	 * Cerebras chat — free tier, world's fastest inference (2000+ tok/sec)
	 * OpenAI-compatible. Get free key at: https://cloud.cerebras.ai
	 * Free tier: rate limited but no credit card required
	 */
	private async chatWithCerebras(
		messages: ChatMessage[],
		model: string,
		temperature: number,
		maxTokens: number,
	): Promise<{ content: string; usage: AIUsageMetrics }> {
		if (!cerebras) {
			throw new Error(
				"Cerebras not configured — set CEREBRAS_API_KEY environment variable",
			);
		}
		const cerebrasModel =
			model === "gpt-oss-120b" || model === "zai-glm-4.7"
				? model
				: CEREBRAS_DEFAULT_MODEL;
		const response = await cerebras.chat.completions.create({
			model: cerebrasModel,
			messages,
			temperature,
			max_tokens: maxTokens,
			stream: false,
		});
		const content = response.choices[0]?.message?.content || "";
		const usage: AIUsageMetrics = {
			provider: "cerebras",
			model: cerebrasModel,
			promptTokens: response.usage?.prompt_tokens || 0,
			completionTokens: response.usage?.completion_tokens || 0,
			totalTokens: response.usage?.total_tokens || 0,
			requestId: response.id,
			timestamp: new Date(),
		};
		this.usageMetrics.push(usage);
		return { content, usage };
	}

	/**
	 * Cloudflare Workers AI chat — free forever on Workers free plan
	 * OpenAI-compatible endpoint via AI Gateway.
	 * Get key at: https://dash.cloudflare.com → AI → Workers AI
	 * Requires: CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_KEY
	 */
	private async chatWithCloudflare(
		messages: ChatMessage[],
		model: string,
		temperature: number,
		maxTokens: number,
	): Promise<{ content: string; usage: AIUsageMetrics }> {
		if (!cloudflare) {
			throw new Error(
				"Cloudflare AI not configured — set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_KEY",
			);
		}
		const cfModel = model.startsWith("@cf/") ? model : CLOUDFLARE_DEFAULT_MODEL;
		const response = await cloudflare.chat.completions.create({
			model: cfModel,
			messages,
			temperature,
			max_tokens: maxTokens,
			stream: false,
		});
		const content = response.choices[0]?.message?.content || "";
		const usage: AIUsageMetrics = {
			provider: "cloudflare",
			model: cfModel,
			promptTokens: response.usage?.prompt_tokens || 0,
			completionTokens: response.usage?.completion_tokens || 0,
			totalTokens: response.usage?.total_tokens || 0,
			requestId: response.id || `cf-${Date.now()}`,
			timestamp: new Date(),
		};
		this.usageMetrics.push(usage);
		return { content, usage };
	}

	/**
	 * Anthropic Claude — best instruction following, JSON extraction
	 * Requires ANTHROPIC_API_KEY. Get $5 free at: https://console.anthropic.com
	 * Uses Anthropic's native Messages API directly (not OpenAI-compatible)
	 */
	private async chatWithAnthropic(
		messages: ChatMessage[],
		model: string,
		temperature: number,
		maxTokens: number,
	): Promise<{ content: string; usage: AIUsageMetrics }> {
		if (!anthropicApiKey) {
			throw new Error(
				"Anthropic not configured — set ANTHROPIC_API_KEY environment variable",
			);
		}
		const systemMsg = messages.find((m) => m.role === "system")?.content || "";
		const userMsgs = messages
			.filter((m) => m.role !== "system")
			.map((m) => ({
				role: m.role as "user" | "assistant",
				content: m.content,
			}));

		const res = await fetch("https://api.anthropic.com/v1/messages", {
			method: "POST",
			headers: {
				"x-api-key": anthropicApiKey,
				"anthropic-version": "2023-06-01",
				"content-type": "application/json",
			},
			body: JSON.stringify({
				model,
				max_tokens: maxTokens,
				temperature,
				system: systemMsg || undefined,
				messages: userMsgs,
			}),
		});

		if (!res.ok) {
			const err = (await res.json().catch(() => ({}))) as any;
			throw Object.assign(
				new Error(err.error?.message || `Anthropic ${res.status}`),
				{ status: res.status },
			);
		}

		const data = (await res.json()) as any;
		const content = data.content?.[0]?.text || "";
		const usage: AIUsageMetrics = {
			provider: "anthropic",
			model,
			promptTokens: data.usage?.input_tokens || 0,
			completionTokens: data.usage?.output_tokens || 0,
			totalTokens:
				(data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
			requestId: data.id || `anthropic-${Date.now()}`,
			timestamp: new Date(),
		};
		this.usageMetrics.push(usage);
		return { content, usage };
	}

	/**
	 * OpenAI streaming chat (via Replit AI Integrations)
	 */
	private async streamOpenAI(
		messages: ChatMessage[],
		model: string,
		temperature: number,
		maxTokens: number,
		onChunk: (chunk: string) => void,
	): Promise<{ content: string; usage: AIUsageMetrics }> {
		const isO1 = model.startsWith("o1-");
		const client = openaiDirect || openaiIntegrations;
		if (!client) {
			throw new Error("OpenAI provider not configured for streaming");
		}
		const stream = await client.chat.completions.create({
			model,
			messages,
			temperature: isO1 ? undefined : temperature,
			max_completion_tokens: isO1 ? maxTokens : undefined,
			max_tokens: !isO1 ? maxTokens : undefined,
			stream: true,
		});

		let fullContent = "";
		let requestId = "";

		for await (const chunk of stream) {
			const content = chunk.choices[0]?.delta?.content || "";
			if (content) {
				fullContent += content;
				onChunk(content);
			}
			if (!requestId && chunk.id) {
				requestId = chunk.id;
			}
		}

		const usage: AIUsageMetrics = {
			provider: openaiDirect ? "openai-direct" : "openai",
			model,
			promptTokens: 0, // Not available in streaming
			completionTokens: 0,
			totalTokens: 0,
			requestId,
			timestamp: new Date(),
		};

		this.usageMetrics.push(usage);
		return { content: fullContent, usage };
	}

	/**
	 * Gemini chat completion
	 */
	private async chatWithGemini(
		messages: ChatMessage[],
		model: string,
		temperature: number,
		maxTokens: number,
		options: AIServiceOptions = {},
	): Promise<{ content: string; usage: AIUsageMetrics }> {
		if (!gemini) {
			throw new Error("Gemini API key not configured");
		}

		// Convert messages to Gemini format
		const systemMessage =
			messages.find((m) => m.role === "system")?.content || "";
		const userMessages = messages.filter((m) => m.role !== "system");
		const prompt = userMessages.map((m) => m.content).join("\n\n");
		const fullPrompt = systemMessage ? `${systemMessage}\n\n${prompt}` : prompt;

		const geminiModel = model.includes("gemini") ? model : "gemini-2.5-flash";

		// Updated for @google/genai SDK structure
		const response = await gemini.models.generateContent({
			model: geminiModel,
			config: {
				temperature,
				maxOutputTokens: maxTokens,
				responseMimeType: options.json ? "application/json" : "text/plain",
				thinkingConfig: { thinkingBudget: 0 }, // Disable thinking mode — prevents thoughtSignature tokens in JSON responses
			},
			contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
		});

		const content = response.text || "";
		const usage: AIUsageMetrics = {
			provider: "gemini",
			model: geminiModel,
			promptTokens: response.usageMetadata?.promptTokenCount || 0,
			completionTokens: response.usageMetadata?.candidatesTokenCount || 0,
			totalTokens: response.usageMetadata?.totalTokenCount || 0,
			requestId: `gemini-${Date.now()}`,
			timestamp: new Date(),
		};
		this.usageMetrics.push(usage);
		return { content, usage };
	}

	/**
	 * Gemini streaming chat
	 */
	private async streamGemini(
		messages: ChatMessage[],
		model: string,
		temperature: number,
		maxTokens: number,
		onChunk: (chunk: string) => void,
	): Promise<{ content: string; usage: AIUsageMetrics }> {
		if (!gemini) {
			throw new Error("Gemini API key not configured");
		}

		// Convert messages to Gemini format
		const systemMessage =
			messages.find((m) => m.role === "system")?.content || "";
		const userMessages = messages.filter((m) => m.role !== "system");
		const prompt = userMessages.map((m) => m.content).join("\n\n");
		const fullPrompt = systemMessage ? `${systemMessage}\n\n${prompt}` : prompt;

		const geminiModel = model.includes("gemini") ? model : "gemini-2.5-flash";

		// Updated for @google/genai SDK structure
		const stream = await gemini.models.generateContentStream({
			model: geminiModel,
			config: {
				temperature,
				maxOutputTokens: maxTokens,
				thinkingConfig: { thinkingBudget: 0 }, // Disable thinking mode for streaming
			},
			contents: [{ role: "user", parts: [{ text: fullPrompt }] }],
		});

		let fullContent = "";
		let finalResponse: any = null;

		for await (const chunk of stream) {
			const chunkText = chunk.text || "";
			fullContent += chunkText;
			onChunk(chunkText);
			finalResponse = chunk;
		}

		const usage: AIUsageMetrics = {
			provider: "gemini",
			model: geminiModel,
			promptTokens: finalResponse?.usageMetadata?.promptTokenCount || 0,
			completionTokens: finalResponse?.usageMetadata?.candidatesTokenCount || 0,
			totalTokens: finalResponse?.usageMetadata?.totalTokenCount || 0,
			requestId: `gemini-stream-${Date.now()}`,
			timestamp: new Date(),
		};

		this.usageMetrics.push(usage);
		return { content: fullContent, usage };
	}

	/**
	 * Get usage statistics
	 */
	getUsageMetrics(): AIUsageMetrics[] {
		return this.usageMetrics;
	}

	/**
	 * Get total cost estimate (rough approximation)
	 */
	getTotalCost(): { openai: number; gemini: number; total: number } {
		let openaiCost = 0;
		let geminiCost = 0;

		this.usageMetrics.forEach((metric) => {
			if (metric.provider === "openai" || metric.provider === "openai-direct") {
				// Rough estimate: $0.01 per 1K tokens
				openaiCost += (metric.totalTokens / 1000) * 0.01;
			} else if (metric.provider === "gemini") {
				// Rough estimate: $0.0005 per 1K tokens
				geminiCost += (metric.totalTokens / 1000) * 0.0005;
			}
		});

		return {
			openai: openaiCost,
			gemini: geminiCost,
			total: openaiCost + geminiCost,
		};
	}

	/**
	 * Clear usage metrics
	 */
	clearMetrics(): void {
		this.usageMetrics = [];
	}

	/**
	 * Get recommended model for complex financial analysis
	 */
	getComplexAnalysisModel(): { provider: AIProvider; model: AIModel } {
		if (this.isGpt52Available() && this.isProviderHealthy("openai-direct")) {
			return { provider: "openai-direct", model: "gpt-4o" };
		}
		return { provider: "gemini", model: "gemini-2.5-flash" };
	}
}

export const aiService = new AIService();

// Export helper for checking GPT-4o.2 availability
export const isGpt52Available = () => aiService.isGpt52Available();
export const getComplexAnalysisModel = () =>
	aiService.getComplexAnalysisModel();
