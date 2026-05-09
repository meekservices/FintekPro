import { Router } from 'express';
import part1 from './pick-of-the-day-1';
import part2 from './pick-of-the-day-2';

const router = Router();
  router.use('/', part1);
  router.use('/', part2);

export default router;
