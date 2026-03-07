import { Router } from 'express';
import { Pool } from 'pg';
import { requireServiceAuth } from '../middleware/auth';

const router = Router();

let pool: Pool;
function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  }
  return pool;
}

router.get('/insurance-holdings', requireServiceAuth, async (req: any, res) => {
  const userId = req.serviceUser?.sub;
  try {
    const result = await getPool().query(
      'SELECT * FROM insurance_holdings WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch insurance holdings', detail: err.message });
  }
});

router.post('/insurance-holdings', requireServiceAuth, async (req: any, res) => {
  const userId = req.serviceUser?.sub;
  const body = req.body;
  try {
    const result = await getPool().query(
      `INSERT INTO insurance_holdings
        (user_id, policy_number, policy_name, insurance_company, policy_type, category,
         sum_assured, premium_amount, premium_frequency, policy_start_date,
         policy_maturity_date, depository_name, policy_status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        userId,
        body.policyNumber, body.policyName, body.insuranceCompany,
        body.policyType, body.category, body.sumAssured,
        body.premiumAmount, body.premiumFrequency || 'yearly',
        body.policyStartDate, body.policyMaturityDate || null,
        body.depositoryName, body.policyStatus || 'active',
      ]
    );
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create insurance holding', detail: err.message });
  }
});

router.patch('/insurance-holdings/:id', requireServiceAuth, async (req: any, res) => {
  const userId = req.serviceUser?.sub;
  const { id } = req.params;
  const body = req.body;
  try {
    const fields = Object.keys(body)
      .map((k, i) => `"${k.replace(/([A-Z])/g, '_$1').toLowerCase()}" = $${i + 1}`)
      .join(', ');
    const values = Object.values(body);
    const result = await getPool().query(
      `UPDATE insurance_holdings SET ${fields}, updated_at = NOW() WHERE id = $${values.length + 1} AND user_id = $${values.length + 2} RETURNING *`,
      [...values, id, userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Holding not found or unauthorized' });
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update insurance holding', detail: err.message });
  }
});

router.delete('/insurance-holdings/:id', requireServiceAuth, async (req: any, res) => {
  const userId = req.serviceUser?.sub;
  const { id } = req.params;
  try {
    await getPool().query(
      'DELETE FROM insurance_holdings WHERE id = $1 AND user_id = $2',
      [id, userId]
    );
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete insurance holding', detail: err.message });
  }
});

export default router;
