import { Router } from 'express';
import { requireServiceAuth } from '../middleware/auth';
import { TurtlefinAPI } from '../turtlefin-api';

const router = Router();
const turtlefin = new TurtlefinAPI();

router.get('/products/search', requireServiceAuth, async (req: any, res) => {
  try {
    const { policyType, sumAssured, age, gender } = req.query;
    const quotes = await turtlefin.getPremiumQuotes({
      policyType: policyType as string || 'term',
      sumAssured: Number(sumAssured) || 5000000,
      age: Number(age) || 30,
      gender: (gender as 'M' | 'F') || 'M',
      tenure: 20,
    });
    res.json({ success: true, quotes });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/products/kyc-search', requireServiceAuth, async (req: any, res) => {
  try {
    const { pan, name, dob } = req.body;
    if (!pan || !name || !dob) {
      return res.status(400).json({ success: false, error: 'pan, name and dob are required' });
    }
    const result = await turtlefin.searchPoliciesByKYC({ pan, name, dob });
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
