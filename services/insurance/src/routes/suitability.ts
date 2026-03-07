import { Router } from 'express';
import { requireServiceAuth } from '../middleware/auth';
import { InsuranceSuitabilityService } from '../insurance-suitability-service';

const router = Router();
const suitabilityService = new InsuranceSuitabilityService();

router.post('/insurance/suitability-assessment', requireServiceAuth, async (req: any, res) => {
  const { clientId, agentId, personalInfo, financialProfile, insuranceNeeds, healthProfile } = req.body;
  if (!clientId || !agentId || !personalInfo || !financialProfile || !insuranceNeeds || !healthProfile) {
    return res.status(400).json({
      success: false,
      error: 'All assessment fields are required: clientId, agentId, personalInfo, financialProfile, insuranceNeeds, healthProfile',
    });
  }
  try {
    const assessment = await suitabilityService.conductSuitabilityAssessment({
      clientId, agentId, personalInfo, financialProfile, insuranceNeeds, healthProfile,
    });
    res.json({ success: true, assessment });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/insurance/suitability-assessment/:assessmentId', requireServiceAuth, async (req: any, res) => {
  try {
    const assessment = suitabilityService.getAssessment(req.params.assessmentId);
    if (!assessment) return res.status(404).json({ success: false, error: 'Assessment not found' });
    res.json({
      success: true,
      assessment,
      isValid: suitabilityService.isAssessmentValid(req.params.assessmentId),
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/insurance/suitability-assessment/client/:clientId', requireServiceAuth, async (req: any, res) => {
  try {
    const assessments = suitabilityService.getClientAssessments(req.params.clientId);
    res.json({ success: true, assessments, count: assessments.length });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/insurance/suitability-assessment/:assessmentId/acknowledge', requireServiceAuth, async (req: any, res) => {
  const { clientId } = req.body;
  if (!clientId) return res.status(400).json({ success: false, error: 'clientId is required' });
  try {
    const result = await suitabilityService.acknowledgeAssessment(req.params.assessmentId, clientId);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
