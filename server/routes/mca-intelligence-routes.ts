import { Router } from 'express';
import part1 from './mca-intelligence-routes-1';
import part2 from './mca-intelligence-routes-2';
import part3 from './mca-intelligence-routes-3';

const router = Router();
  router.use('/', part1);
  router.use('/', part2);
  router.use('/', part3);

export default router;
