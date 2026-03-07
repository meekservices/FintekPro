import cors from 'cors';

const ALLOWED_ORIGINS = [
  'https://fintekpro.com',
  'https://www.fintekpro.com',
  'https://admin.fintekpro.com',
  'https://agent.fintekpro.com',
  'https://partner.fintekpro.com',
  'https://ins.fintekpro.com',
];

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const isFintekPro = origin.endsWith('.fintekpro.com') || ALLOWED_ORIGINS.includes(origin);
    const isLocalhost = /^https?:\/\/localhost(:\d+)?$/.test(origin);
    const isReplit = origin.includes('.replit.dev') || origin.includes('.worf.replit.dev');
    if (isFintekPro || isLocalhost || isReplit) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  credentials: true,
});
