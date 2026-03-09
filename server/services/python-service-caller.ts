import axios from 'axios';

export async function callPythonService(endpoint: string, method: 'GET' | 'POST' = 'POST', data?: any) {
  const pythonUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:5000';
  const url = `${pythonUrl}${endpoint}`;
  
  try {
    const response = await axios({
      method,
      url,
      data,
      headers: {
        'Authorization': `Bearer ${process.env.INTERNAL_SERVICE_TOKEN || 'internal-secret'}`
      }
    });
    return response.data;
  } catch (error: any) {
    console.error(`[PythonService] Call failed: ${method} ${endpoint}`, error.message);
    throw error;
  }
}
