import { Router } from 'express';
import part1 from './unlisted-7-2-1';
import part2 from './unlisted-7-2-2';

const router = Router();
  router.use('/', part1);
  router.use('/', part2);

export default router;
