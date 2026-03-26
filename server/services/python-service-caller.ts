import axios from 'axios';
import jwt from 'jsonwebtoken';

function generateInternalServiceToken(): string {
  const secret = process.env.PYTHON_SERVICE_SECRET || process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('PYTHON_SERVICE_SECRET not configured — cannot generate internal service token');
  }
  return jwt.sign(
    { sub: 'internal-cron', role: 'system', roles: ['system'], email: null, mobile: null },
    secret,
    { issuer: 'fintekpro-main', expiresIn: '5m' }
  );
}

export async function callPythonService(endpoint: string, method: 'GET' | 'POST' = 'POST', data?: any) {
  const pythonUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:8001';
  const url = `${pythonUrl}${endpoint}`;
  
  try {
    const token = generateInternalServiceToken();
    const response = await axios({
      method,
      url,
      data,
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return response.data;
  } catch (error: any) {
    console.error(`[PythonService] Call failed: ${method} ${endpoint}`, error.message);
    throw error;
  }
}
