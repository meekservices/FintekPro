/**
 * upstox-token-manager.tsx
 *
 * Admin page for accepting and rotating the Upstox Access Token.
 * Renders at /admin/upstox-token-manager (or inside the Admin panel tabs).
 *
 * Flow:
 *   1. Admin opens page → sees current token status (healthy / expiring / expired)
 *   2. Admin pastes new token from Upstox Developer Portal
 *   3. Click "Validate" → live Upstox probe call confirms the token is valid
 *   4. Click "Rotate Token" → token is stored in Secret Manager + hot-reloaded in-process
 */

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertCircle,
	CheckCircle2,
	Clock,
	ExternalLink,
	Eye,
	EyeOff,
	Key,
	Loader2,
	RefreshCw,
	RotateCcw,
	Shield,
	XCircle,
	Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// ── Types ──────────────────────────────────────────────────────────────────────

interface TokenStatus {
	configured: boolean;
	maskedToken: string | null;
	daysSinceIssued: number | null;
	issuedAt: string | null;
	expiredSince: string | null;
	status: "NOT_CONFIGURED" | "EXPIRED" | "EXPIRING_SOON" | "HEALTHY";
	daysUntilExpiry: number | null;
}

interface RotationStep {
	label: string;
	done: boolean;
}

// ── Status Badge ───────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: TokenStatus["status"] }) {
	const map: Record<TokenStatus["status"], { label: string; variant: "default" | "destructive" | "secondary" | "outline"; icon: React.ReactNode }> = {
		HEALTHY: { label: "Healthy", variant: "default", icon: <CheckCircle2 className="w-3 h-3" /> },
		EXPIRING_SOON: { label: "Expiring Soon", variant: "secondary", icon: <Clock className="w-3 h-3" /> },
		EXPIRED: { label: "Expired", variant: "destructive", icon: <XCircle className="w-3 h-3" /> },
		NOT_CONFIGURED: { label: "Not Configured", variant: "outline", icon: <AlertCircle className="w-3 h-3" /> },
	};
	const { label, variant, icon } = map[status];
	return (
		<Badge variant={variant} className="flex items-center gap-1">
			{icon}
			{label}
		</Badge>
	);
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function UpstoxTokenManager() {
	const { toast } = useToast();
	const queryClient = useQueryClient();

	const [tokenInput, setTokenInput] = useState("");
	const [showToken, setShowToken] = useState(false);
	const [validationState, setValidationState] = useState<"idle" | "valid" | "invalid">("idle");
	const [rotationSteps, setRotationSteps] = useState<RotationStep[]>([]);

	// ── Fetch current token status ─────────────────────────────────────────────
	const { data: statusData, isLoading: statusLoading, refetch: refetchStatus } = useQuery({
		queryKey: ["/api/admin/upstox/token-status"],
		queryFn: async () => {
			const res = await apiRequest("GET", "/api/admin/upstox/token-status");
			const json = await res.json();
			return json.data as TokenStatus;
		},
		refetchInterval: 60_000,
	});

	// ── Validate mutation ──────────────────────────────────────────────────────
	const validateMutation = useMutation({
		mutationFn: async (token: string) => {
			const res = await apiRequest("POST", "/api/admin/upstox/validate-token", { token });
			const json = await res.json();
			if (!json.success) throw new Error(json.error?.message ?? "Validation failed");
			return json;
		},
		onSuccess: () => {
			setValidationState("valid");
			toast({ title: "✅ Token Valid", description: "Upstox LTP probe succeeded — token is live and ready." });
		},
		onError: (err: any) => {
			setValidationState("invalid");
			toast({ title: "❌ Token Invalid", description: err.message, variant: "destructive" });
		},
	});

	// ── Rotation mutation ──────────────────────────────────────────────────────
	const rotateMutation = useMutation({
		mutationFn: async (token: string) => {
			const res = await apiRequest("POST", "/api/admin/upstox/rotate-token", { token });
			const json = await res.json();
			if (!json.success) throw new Error(json.error?.message ?? "Rotation failed");
			return json;
		},
		onSuccess: (data) => {
			const steps: RotationStep[] = (data.data.steps as string[]).map((s: string) => ({
				label: s,
				done: true,
			}));
			setRotationSteps(steps);
			setTokenInput("");
			setValidationState("idle");
			queryClient.invalidateQueries({ queryKey: ["/api/admin/upstox/token-status"] });
			toast({
				title: "🔑 Token Rotated",
				description: `Upstox token updated. Market data is live immediately. Issued: ${data.data.issuedAt}`,
			});
		},
		onError: (err: any) => {
			toast({ title: "Rotation Failed", description: err.message, variant: "destructive" });
		},
	});

	const status = statusData;
	const isWorking = validateMutation.isPending || rotateMutation.isPending;

	const healthPercent = status?.daysUntilExpiry != null
		? Math.max(0, Math.min(100, (status.daysUntilExpiry / 365) * 100))
		: 0;

	return (
		<div className="max-w-3xl mx-auto space-y-6 p-6">
			{/* ── Header ──────────────────────────────────────────────────── */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold flex items-center gap-2">
						<Key className="w-6 h-6 text-blue-500" />
						Upstox Token Manager
					</h1>
					<p className="text-muted-foreground mt-1 text-sm">
						Rotate the Upstox Access Token to restore NSE/BSE market data feed.
					</p>
				</div>
				<Button variant="outline" size="sm" onClick={() => refetchStatus()} disabled={statusLoading}>
					<RefreshCw className={`w-4 h-4 mr-1 ${statusLoading ? "animate-spin" : ""}`} />
					Refresh
				</Button>
			</div>

			{/* ── Current Token Status Card ──────────────────────────────── */}
			<Card>
				<CardHeader className="pb-3">
					<div className="flex items-center justify-between">
						<CardTitle className="text-base flex items-center gap-2">
							<Shield className="w-4 h-4 text-blue-500" />
							Current Token Status
						</CardTitle>
						{status && <StatusBadge status={status.status} />}
					</div>
				</CardHeader>
				<CardContent className="space-y-4">
					{statusLoading ? (
						<div className="flex items-center gap-2 text-muted-foreground">
							<Loader2 className="w-4 h-4 animate-spin" />
							<span className="text-sm">Loading status…</span>
						</div>
					) : status ? (
						<>
							<div className="grid grid-cols-2 gap-4 text-sm">
								<div>
									<p className="text-muted-foreground">Masked Token</p>
									<p className="font-mono font-medium">{status.maskedToken ?? "—"}</p>
								</div>
								<div>
									<p className="text-muted-foreground">Issued</p>
									<p className="font-medium">{status.issuedAt ?? "Unknown"}</p>
								</div>
								<div>
									<p className="text-muted-foreground">Days Since Issued</p>
									<p className="font-medium">{status.daysSinceIssued ?? "—"}</p>
								</div>
								<div>
									<p className="text-muted-foreground">Days Until Expiry</p>
									<p className={`font-medium ${(status.daysUntilExpiry ?? 365) < 30 ? "text-red-500" : ""}`}>
										{status.daysUntilExpiry ?? "—"}
									</p>
								</div>
							</div>

							{status.configured && status.daysUntilExpiry != null && (
								<div className="space-y-1">
									<div className="flex items-center justify-between text-xs text-muted-foreground">
										<span>Token health</span>
										<span>{Math.round(healthPercent)}% remaining</span>
									</div>
									<Progress
										value={healthPercent}
										className={`h-2 ${healthPercent < 10 ? "[&>div]:bg-red-500" : healthPercent < 30 ? "[&>div]:bg-amber-500" : "[&>div]:bg-green-500"}`}
									/>
								</div>
							)}

							{status.status === "EXPIRED" && (
								<Alert variant="destructive">
									<AlertCircle className="h-4 w-4" />
									<AlertTitle>Token Expired</AlertTitle>
									<AlertDescription>
										Live NSE/BSE pricing has fallen back to secondary providers. Rotate your token immediately.
									</AlertDescription>
								</Alert>
							)}

							{status.status === "NOT_CONFIGURED" && (
								<Alert>
									<AlertCircle className="h-4 w-4" />
									<AlertTitle>Token Not Configured</AlertTitle>
									<AlertDescription>
										Market data is currently sourced from fallback providers only. Set your Upstox token below.
									</AlertDescription>
								</Alert>
							)}
						</>
					) : (
						<p className="text-sm text-muted-foreground">Unable to load status.</p>
					)}
				</CardContent>
			</Card>

			{/* ── How to get the token ───────────────────────────────────── */}
			<Card>
				<CardHeader className="pb-2">
					<CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
						How to Get a New Token
					</CardTitle>
				</CardHeader>
				<CardContent>
					<ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
						<li>
							Open the{" "}
							<a
								href="https://account.upstox.com/developer/apps"
								target="_blank"
								rel="noopener noreferrer"
								className="text-blue-500 underline inline-flex items-center gap-1"
							>
								Upstox Developer Portal
								<ExternalLink className="w-3 h-3" />
							</a>
						</li>
						<li>Select your app → click <strong>Generate Access Token</strong></li>
						<li>Complete the login flow (OTP + TOTP if enabled)</li>
						<li>Copy the <code className="bg-muted px-1 rounded text-xs">access_token</code> from the response</li>
						<li>Paste it below, validate, then rotate</li>
					</ol>
				</CardContent>
			</Card>

			{/* ── Token Input & Actions ──────────────────────────────────── */}
			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-base flex items-center gap-2">
						<RotateCcw className="w-4 h-4 text-orange-500" />
						Rotate Token
					</CardTitle>
					<CardDescription>
						Paste the new access token from the Upstox Developer Portal. Validate before rotating.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{/* Token textarea */}
					<div className="relative">
						<Textarea
							id="upstox-token-input"
							placeholder="Paste your Upstox access_token here…"
							value={showToken ? tokenInput : tokenInput.replace(/./g, "•")}
							onChange={(e) => {
								// When masked, we can't accurately track changes — so always update raw
								setTokenInput(e.target.value.replace(/•/g, "") || e.target.value);
								setValidationState("idle");
								setRotationSteps([]);
							}}
							onFocus={() => setShowToken(true)}
							className="font-mono text-sm pr-10 min-h-[80px] resize-none"
						/>
						<button
							type="button"
							onClick={() => setShowToken((v) => !v)}
							className="absolute right-2 top-2 text-muted-foreground hover:text-foreground transition-colors"
							title={showToken ? "Hide token" : "Show token"}
						>
							{showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
						</button>
					</div>

					{/* Validation state feedback */}
					{validationState === "valid" && (
						<div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
							<CheckCircle2 className="w-4 h-4" />
							Token validated — Upstox LTP probe returned live data ✓
						</div>
					)}
					{validationState === "invalid" && (
						<div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
							<XCircle className="w-4 h-4" />
							Token is invalid — check portal and try again
						</div>
					)}

					{/* Action buttons */}
					<div className="flex gap-3">
						<Button
							id="upstox-validate-btn"
							variant="outline"
							disabled={!tokenInput.trim() || isWorking}
							onClick={() => validateMutation.mutate(tokenInput.trim())}
						>
							{validateMutation.isPending ? (
								<Loader2 className="w-4 h-4 mr-2 animate-spin" />
							) : (
								<Zap className="w-4 h-4 mr-2" />
							)}
							Validate Token
						</Button>

						<Button
							id="upstox-rotate-btn"
							disabled={!tokenInput.trim() || isWorking || validationState === "invalid"}
							onClick={() => rotateMutation.mutate(tokenInput.trim())}
						>
							{rotateMutation.isPending ? (
								<Loader2 className="w-4 h-4 mr-2 animate-spin" />
							) : (
								<RotateCcw className="w-4 h-4 mr-2" />
							)}
							Rotate Token
						</Button>
					</div>

					<p className="text-xs text-muted-foreground">
						<strong>Note:</strong> Validate first to confirm the token is live. Rotation updates Secret Manager,
						hot-reloads the service immediately, and triggers a new Cloud Run revision in ~60s.
					</p>

					{/* Rotation result steps */}
					{rotationSteps.length > 0 && (
						<>
							<Separator />
							<div className="space-y-2">
								<p className="text-sm font-medium">Rotation Steps:</p>
								{rotationSteps.map((step, i) => (
									<div key={i} className="flex items-start gap-2 text-sm">
										<CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
										<span>{step.label}</span>
									</div>
								))}
							</div>
						</>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
