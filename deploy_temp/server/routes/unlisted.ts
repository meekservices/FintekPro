import { Router } from 'express';
import part1 from './unlisted-1';
import part2 from './unlisted-2';
import part3 from './unlisted-3';
import part4 from './unlisted-4';
import part5 from './unlisted-5';
import part6 from './unlisted-6';
import part7 from './unlisted-7';
import part8 from './unlisted-8';
import part9 from './unlisted-9';
import part10 from './unlisted-10';
import part11 from './unlisted-11';

const router = Router();
  router.use('/', part1);
  router.use('/', part2);
  router.use('/', part3);
  router.use('/', part4);
  router.use('/', part5);
  router.use('/', part6);
  router.use('/', part7);
  router.use('/', part8);
  router.use('/', part9);
  router.use('/', part10);
  router.use('/', part11);

export default router;
