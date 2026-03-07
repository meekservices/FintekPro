/**
 * Insurance Service Proxy Client
 *
 * Forwards requests from the main portal to the Insurance micro-service
 * (ins.fintekpro.com / localhost:5001 in dev).
 *
 * Set INSURANCE_SERVICE_URL in env to point at the deployed service.
 * Leave it empty to fall through to the local fallback below.
 */
import { Request, Response } from 'express';
import { issueServiceToken } from '../utils/service-token';

const BASE_URL = process.env.INSURANCE_SERVICE_URL?.replace(/\/$/, '') || '';

async function fetchWithToken(user: any, url: string, init: RequestInit = {}): Promise<globalThis.Response> {
  const token = issueServiceToken(user);
  return fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init.headers as Record<string, string> || {}),
    },
  });
}

export async function proxyToInsurance(req: Request, res: Response, path: string): Promise<void> {
  if (!BASE_URL) {
    res.status(503).json({
      error: 'Insurance Service not configured',
      detail: 'Set INSURANCE_SERVICE_URL environment variable to enable the insurance micro-service.',
    });
    return;
  }

  const url = `${BASE_URL}/api${path}`;
  const body = ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body);

  try {
    const upstream = await fetchWithToken((req as any).user, url, {
      method: req.method,
      body,
    });
    const json = await upstream.json();
    res.status(upstream.status).json(json);
  } catch (err: any) {
    res.status(502).json({ error: 'Insurance Service unreachable', detail: err.message });
  }
}
