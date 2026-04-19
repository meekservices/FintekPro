import jwt from 'jsonwebtoken';

const SECRET = process.env.SESSION_SECRET!;
const EXPIRY = 900; // 15 minutes

export interface ServiceTokenPayload {
  sub: number;
  role: string;
  roles: string[];
  email: string | null;
  mobile: string | null;
}

export function issueServiceToken(user: any): string {
  if (!SECRET) throw new Error('SESSION_SECRET is not configured');
  const payload: ServiceTokenPayload = {
    sub: user.id,
    role: user.role || 'user',
    roles: user.roles || (user.role ? [user.role] : ['user']),
    email: user.email ?? null,
    mobile: user.mobile ?? null,
  };
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRY, issuer: 'fintekpro-main' });
}

export function verifyServiceToken(token: string): ServiceTokenPayload {
  if (!SECRET) throw new Error('SESSION_SECRET is not configured');
  return jwt.verify(token, SECRET, { issuer: 'fintekpro-main' }) as unknown as ServiceTokenPayload;
}
