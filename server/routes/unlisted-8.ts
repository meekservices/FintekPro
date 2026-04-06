import { Router } from 'express';
import part1 from './unlisted-8-1';
import part2 from './unlisted-8-2';

const router = Router();
  router.use('/', part1);
  router.use('/', part2);

export default router;
