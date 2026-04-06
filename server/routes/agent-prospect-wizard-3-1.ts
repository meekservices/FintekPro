import { Router } from 'express';
import part1 from './agent-prospect-wizard-3-1-1';
import part2 from './agent-prospect-wizard-3-1-2';

const router = Router();
  router.use('/', part1);
  router.use('/', part2);

export default router;
