import { Router } from 'express';
import part1 from './proposal-builder-routes-1';
import part2 from './proposal-builder-routes-2';

const router = Router();
  router.use('/', part1);
  router.use('/', part2);

export default router;
