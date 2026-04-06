import { Router } from 'express';
import part1 from './meeting-bookings-1';
import part2 from './meeting-bookings-2';

const router = Router();
  router.use('/', part1);
  router.use('/', part2);

export default router;
