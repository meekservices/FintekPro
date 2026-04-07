/**
 * Python Analytics Service Proxy Client
 *
 * Forwards requests from the main portal to the FintekPro Python micro-service.
 * Set PYTHON_SERVICE_URL in env to point at the deployed Python service.
 * Leave it unset to receive a 503 with a clear message — no silent fallback.
 *
 * Two usage modes:
 *  1. proxyToPython(req, res, path) — HTTP proxy pass-through for Express routes
 *  2. callPython<T>(user, path, method?, body?) — direct programmatic call from Node.js services
 *     Returns null on any error so callers can fall back gracefully.
 *
 * Circuit breaker:
 *  After CIRCUIT_OPEN_THRESHOLD consecutive non-200 responses the breaker opens
 *  for CIRCUIT_OPEN_DURATION_MS. All calls during the open window return null
 *  immediately (or 503 for proxy calls) — no outbound requests are made.
 *  This prevents a secret-mismatch / Python-down event from generating a
 *  log flood that can destabilise the main service under Railway's health checks.
 */
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';

// ── Circuit breaker state ──────────────────────────────────────────────────
const CIRCUIT_OPEN_THRESHOLD  = 3;            // consecutive failures before opening
const CIRCUIT_OPEN_DURATION_MS = 30 * 60 * 1000; // 30 minutes open before retry (prevents hourly scheduler hammering a dead service)

let circuitFailures   = 0;
let circuitOpenUntil  = 0;   // epoch ms — 0 means closed

// ── Python body-error deduplication ────────────────────────────────────────
// Prevents log floods when a batch job calls callPython() many times and the
// Python service returns the same error for each call (e.g. "No trained model
// found" when no ML model exists yet). Each unique error message is logged once;
// subsequent identical messages are suppressed until the map is cleared at
// the start of each new minute.
const seenPythonErrors = new Map<string, number>(); // message → last-logged minute
function logPythonBodyErrorOnce(path: string, message: string): void {
  const minuteKey = Math.floor(Date.now() / 60_000);
  const key = `${path}::${message}`;
  if (seenPythonErrors.get(key) === minuteKey) return; // already logged this minute
  seenPythonErrors.set(key, minuteKey);
  // Keep map bounded
  if (seenPythonErrors.size > 100) seenPythonErrors.clear();
  console.warn(`[PythonClient] POST ${path} → Python error: ${message}`);
}

// ── Health tracking state ──────────────────────────────────────────────────
let lastSuccessAt: Date | null = null;
let consecutiveFailures = 0;

export function getPythonHealthState() {
  return {
    lastSuccessAt,
    consecutiveFailures,
    circuitOpen: circuitOpenUntil > 0 && Date.now() < circuitOpenUntil,
    circuitOpenUntil: circuitOpenUntil > 0 ? new Date(circuitOpenUntil) : null,
  };
}

/**
 * Returns a structured degraded response envelope for a given Python feature.
 * Use this instead of raw res.status(503).json(...) so all Python routes
 * return a consistent shape that the frontend can detect and handle gracefully.
 */
export function pythonDegradedResponse(
  feature: string,
  fallback?: Record<string, unknown>,
  reason = 'Analytics service temporarily unavailable',
) {
  return {
    degraded: true,
    feature,
    reason,
    fallback: fallback ?? null,
  };
}

function circuitIsOpen(): boolean {
  if (circuitOpenUntil === 0) return false;
  if (Date.now() < circuitOpenUntil) return true;
  // Half-open: allow one probe
  circuitOpenUntil = 0;
  return false;
}

function recordFailure(status?: number): void {
  circuitFailures++;
  consecutiveFailures++;
  if (circuitFailures >= CIRCUIT_OPEN_THRESHOLD) {
    const wasOpen = circuitOpenUntil > 0;
    circuitOpenUntil = Date.now() + CIRCUIT_OPEN_DURATION_MS;
    if (!wasOpen) {
      console.warn(
        `[PythonClient] ⚡ Circuit OPEN after ${circuitFailures} consecutive failures` +
        (status ? ` (last status: ${status})` : '') +
        ` — pausing calls for ${CIRCUIT_OPEN_DURATION_MS / 1000}s`
      );
      if (status === 502) {
        const url = process.env.PYTHON_SERVICE_URL || '(not set)';
        console.warn(
          `[PythonClient] 💡 Railway hint: PYTHON_SERVICE_URL is "${url}" but the service returned 502.` +
          ` Check Railway → Python service → Deployments to ensure it is running and healthy.` +
          ` The expected value is: http://<python-service-name>.railway.internal:8080` +
          ` (port 8080 is required for Railway private networking — the client auto-injects it for .railway.internal URLs).` +
          ` AI scoring and quant features will be degraded until the service is reachable.`
        );
      }
    }
  }
}

function recordSuccess(): void {
  if (circuitFailures > 0) {
    console.info('[PythonClient] ✅ Circuit CLOSED — Python service healthy again');
  }
  circuitFailures = 0;
  circuitOpenUntil = 0;
  consecutiveFailures = 0;
  lastSuccessAt = new Date();
}

// ── URL helpers ───────────────────────────────────────────────────────────
function getBaseUrl(): string {
  let url = process.env.PYTHON_SERVICE_URL?.trim() || '';
  if (!url) return '';
  url = url.replace(/\/$/, '');
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `http://${url}`;
  }
  // Railway private networking requires explicit port 8080.
  // Auto-inject it when the URL is a .railway.internal hostname without a port.
  // e.g. http://fintek-analytics.railway.internal → http://fintek-analytics.railway.internal:8080
  if (url.includes('.railway.internal')) {
    try {
      const parsed = new URL(url);
      if (!parsed.port) {
        parsed.port = '8080';
        url = parsed.toString().replace(/\/$/, '');
      }
    } catch { /* malformed URL — use as-is */ }
  }
  return url;
}

function issuePythonToken(user: any): string {
  const secret = process.env.PYTHON_SERVICE_SECRET || process.env.SESSION_SECRET;
  if (!secret) throw new Error('PYTHON_SERVICE_SECRET not configured');
  return jwt.sign(
    {
      sub: String(user.id),
      role: user.role || 'user',
      roles: user.roles || (user.role ? [user.role] : ['user']),
      email: user.email ?? null,
      mobile: user.mobile ?? null,
    },
    secret,
    { expiresIn: 900, issuer: 'fintekpro-main' }
  );
}

const SYSTEM_USER = {
  id: 'system',
  role: 'admin',
  roles: ['admin'],
  email: 'system@fintekpro.internal',
  mobile: null,
};

async function fetchWithToken(user: any, url: string, init: RequestInit = {}): Promise<globalThis.Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> || {}),
  };
  if (user) {
    headers['Authorization'] = `Bearer ${issuePythonToken(user)}`;
  }
  return fetch(url, { ...init, headers });
}

export function isPythonServiceConfigured(): boolean {
  return !!getBaseUrl();
}

export function getPythonBaseUrl(): string {
  return getBaseUrl();
}

/**
 * Active health probe — bypasses the circuit breaker so it can be used to
 * RESET the circuit after a cold-start 502 storm.
 *
 * Call this 45–60 s after server boot so the Python service has time to
 * finish its scikit-learn import (~30 s on Railway).
 *
 * Returns true if the Python service is reachable and healthy.
 */
export async function probePythonHealth(): Promise<boolean> {
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    console.info('[PythonClient] ℹ️  PYTHON_SERVICE_URL not set — Python features are disabled');
    return false;
  }
  const url = `${baseUrl}/health`;
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) {
      const json = await res.json().catch(() => ({}));
      recordSuccess();
      const caps: string[] = json?.capabilities ?? [];
      console.info(
        `[PythonClient] ✅ Python service healthy at ${baseUrl}` +
        (caps.length ? ` — capabilities: ${caps.slice(0, 5).join(', ')}${caps.length > 5 ? '…' : ''}` : '')
      );
      return true;
    }
    console.warn(`[PythonClient] ⚠️  Python health probe → HTTP ${res.status} from ${url}`);
    recordFailure(res.status);
    return false;
  } catch (err: any) {
    const tip = baseUrl.includes('.railway.internal')
      ? 'Check Railway → Fintek Analytics service → Deployments'
      : `Verify PYTHON_SERVICE_URL="${baseUrl}" is reachable`;
    console.warn(`[PythonClient] ❌ Python health probe failed: ${err.message}. ${tip}`);
    recordFailure();
    return false;
  }
}

/**
 * Keep-alive pinger — prevents Railway from sleeping the Python service.
 * Sends a lightweight GET /health every 5 minutes. Silent on success;
 * logs a single warning if the ping fails (avoids log spam).
 *
 * Only starts when PYTHON_SERVICE_URL is set. Safe to call unconditionally
 * at boot — it no-ops if the URL is absent.
 */
export function startPythonKeepAlive(): void {
  const baseUrl = getBaseUrl();
  if (!baseUrl) return;

  const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
  let lastWasHealthy = true;

  const ping = async () => {
    try {
      const res = await fetch(`${baseUrl}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(8_000),
      });
      if (res.ok) {
        if (!lastWasHealthy) {
          console.info('[PythonClient] ✅ Keep-alive: Python service recovered');
        }
        // Always reset the circuit on a successful ping — even if the circuit was
        // tripped by other callers (e.g. boot-time ml/score bursts) rather than
        // by a keep-alive failure.
        recordSuccess();
        lastWasHealthy = true;
      } else {
        if (lastWasHealthy) {
          console.warn(`[PythonClient] ⚠️  Keep-alive ping → HTTP ${res.status} from ${baseUrl}/health`);
        }
        lastWasHealthy = false;
        recordFailure(res.status);
      }
    } catch (err: any) {
      if (lastWasHealthy) {
        console.warn(`[PythonClient] ⚠️  Keep-alive ping failed: ${err.message}`);
      }
      lastWasHealthy = false;
      recordFailure();
    }
  };

  console.info(`[PythonClient] 🔄 Keep-alive active — pinging ${baseUrl}/health every 5 min`);
  setInterval(ping, INTERVAL_MS);
}

export async function proxyToPython(
  req: Request,
  res: Response,
  path: string,
  feature = 'analytics',
  fallback?: Record<string, unknown>,
): Promise<void> {
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    // Return HTTP 200 so TanStack Query resolves to `data` (not `error`).
    // The frontend detects degradation via data.degraded === true.
    res.status(200).json(pythonDegradedResponse(
      feature,
      fallback,
      'Analytics service not configured — set PYTHON_SERVICE_URL to enable.',
    ));
    return;
  }

  if (circuitIsOpen()) {
    res.status(200).json(pythonDegradedResponse(
      feature,
      fallback,
      'Analytics service temporarily unavailable — circuit breaker open, retrying automatically.',
    ));
    return;
  }

  const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
  const url = `${baseUrl}${path}${queryString}`;
  const body = ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body);

  try {
    const upstream = await fetchWithToken((req as any).user, url, {
      method: req.method,
      body,
      signal: AbortSignal.timeout(30_000),
    });
    const json = await upstream.json();
    if (upstream.ok) {
      recordSuccess();
      res.status(200).json(json);
    } else if (upstream.status >= 400 && upstream.status < 500) {
      // 4xx errors are client/input errors from the Python service — pass through
      // with the original status so the caller receives meaningful validation feedback.
      recordFailure(upstream.status);
      res.status(upstream.status).json(json);
    } else {
      // 5xx or unexpected errors indicate service outage — return a structured
      // degraded envelope with HTTP 200 so TanStack Query resolves to `data`
      // and the frontend can render the graceful fallback UI.
      recordFailure(upstream.status);
      res.status(200).json(pythonDegradedResponse(
        feature,
        fallback,
        `Analytics service returned an error (HTTP ${upstream.status}).`,
      ));
    }
  } catch (err: any) {
    recordFailure();
    res.status(200).json(pythonDegradedResponse(
      feature,
      fallback,
      'Analytics service unreachable.',
    ));
  }
}

/**
 * Programmatic call to the Python sidecar from within Node.js services.
 * Uses a system-level service token (role: admin).
 * Returns null on any network/timeout/parse error so callers can fall back to Node.js engines.
 *
 * @param path  Python route path, e.g. '/api/quant/mvo'
 * @param method HTTP method (default GET)
 * @param body  JSON-serialisable payload for POST requests
 * @param userForToken Optional user object for scoped token (defaults to SYSTEM_USER)
 */
export async function callPython<T = any>(
  path: string,
  method: 'GET' | 'POST' = 'GET',
  body?: unknown,
  userForToken?: any,
): Promise<T | null> {
  const baseUrl = getBaseUrl();
  if (!baseUrl) return null;

  if (circuitIsOpen()) return null;

  const url = `${baseUrl}${path}`;
  const user = userForToken ?? SYSTEM_USER;

  try {
    const res = await fetchWithToken(user, url, {
      method,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const summary = text.replace(/\s+/g, ' ').slice(0, 120);
      // Only log if circuit hasn't just opened to avoid log flooding
      if (circuitFailures < CIRCUIT_OPEN_THRESHOLD) {
        console.warn(`[PythonClient] ${method} ${path} → HTTP ${res.status}: ${summary}`);
      }
      recordFailure(res.status);
      return null;
    }

    const json = await res.json();
    recordSuccess();

    if (json && typeof json === 'object' && 'error' in json) {
      logPythonBodyErrorOnce(path, String(json.error));
      return null;
    }

    return json as T;
  } catch (err: any) {
    if (circuitFailures < CIRCUIT_OPEN_THRESHOLD) {
      console.warn(`[PythonClient] ${method} ${path} unreachable: ${err.message}`);
    }
    recordFailure();
    return null;
  }
}
