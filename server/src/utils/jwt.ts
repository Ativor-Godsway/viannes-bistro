import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import type { UserRole } from '../models/User';

export interface JwtPayload {
  id: string;
  role: UserRole;
}

// Validated at boot (config/env.ts): at least 32 characters, and NO default.
// The old `|| 'dev_secret_change_me'` fallback meant a server missing the env
// var still signed and accepted admin sessions with a published secret.
const SECRET = env.JWT_SECRET;
const EXPIRES_IN = env.JWT_EXPIRES_IN;

/**
 * Admin sessions are short-lived on purpose.
 *
 * The token now lives in localStorage, where an XSS could read it (see
 * middleware/auth.ts). An httpOnly cookie made theft impossible; expiry is the
 * mitigation that replaces it, so a stolen admin token stops working the same
 * day rather than in a week. Customers keep the longer window — their token
 * grants far less.
 */
const ADMIN_EXPIRES_IN = '12h';

export function signToken(payload: JwtPayload): string {
  const expiresIn = payload.role === 'admin' ? ADMIN_EXPIRES_IN : EXPIRES_IN;
  return jwt.sign(payload, SECRET, { expiresIn: expiresIn as jwt.SignOptions['expiresIn'] });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, SECRET) as JwtPayload;
}
