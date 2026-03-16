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
 */
import { Request, Response } from 'express';
import { issueServiceToken } from '../utils/service-token';

function getBaseUrl(): string {
  return process.env.PYTHON_SERVICE_URL?.replace(/\/$/, '') || '';
}

const SYSTEM_USER = {
  id: 0,
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
    headers['Authorization'] = `Bearer ${issueServiceToken(user)}`;
  }
  return fetch(url, { ...init, headers });
}

export function isPythonServiceConfigured(): boolean {
  return !!getBaseUrl();
}

export async function proxyToPython(req: Request, res: Response, path: string): Promise<void> {
  const baseUrl = getBaseUrl();
  if (!baseUrl) {
    res.status(503).json({
      error: 'Quant analytics service unavailable',
      degraded: true,
      detail: 'Set PYTHON_SERVICE_URL environment variable to enable the Python micro-service.',
      hint: 'Run services/python/ locally or deploy it and set PYTHON_SERVICE_URL to its URL.',
    });
    return;
  }

  const queryString = req.url.includes('?') ? req.url.substring(req.url.indexOf('?')) : '';
  const url = `${baseUrl}${path}${queryString}`;
  const body = ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body);

  try {
    const upstream = await fetchWithToken((req as any).user, url, {
      method: req.method,
      body,
    });
    const json = await upstream.json();
    res.status(upstream.status).json(json);
  } catch (err: any) {
    res.status(502).json({
      error: 'Python Analytics Service unreachable',
      detail: err.message,
    });
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

  const url = `${baseUrl}${path}`;
  const user = userForToken ?? SYSTEM_USER;

  try {
    const res = await fetchWithToken(user, url, {
      method,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn(`[PythonClient] ${method} ${path} → HTTP ${res.status}: ${text.slice(0, 200)}`);
      return null;
    }

    const json = await res.json();

    if (json && typeof json === 'object' && 'error' in json) {
      console.warn(`[PythonClient] ${method} ${path} → Python error: ${json.error}`);
      return null;
    }

    return json as T;
  } catch (err: any) {
    console.warn(`[PythonClient] ${method} ${path} unreachable: ${err.message}`);
    return null;
  }
}
