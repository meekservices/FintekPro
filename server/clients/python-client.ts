/**
 * Python Analytics Service Proxy Client
 *
 * Forwards requests from the main portal to the FintekPro Python micro-service.
 * Set PYTHON_SERVICE_URL in env to point at the deployed Python service.
 * Leave it unset to receive a 503 with a clear message — no silent fallback.
 */
import { Request, Response } from 'express';
import { issueServiceToken } from '../utils/service-token';

function getBaseUrl(): string {
  return process.env.PYTHON_SERVICE_URL?.replace(/\/$/, '') || '';
}

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
      error: 'Python Analytics Service not configured',
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
