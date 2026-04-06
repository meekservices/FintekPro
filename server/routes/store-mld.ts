import { Router } from 'express';
import part1 from './store-mld-1';
import part2 from './store-mld-2';

const router = Router();
  router.use('/', part1);
  router.use('/', part2);

export default router;
