import { Request, Response, NextFunction } from 'express';
import { verifyToken, JwtPayload } from '../utils/jwt';
import { ApiError } from './error';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * The session token, from `Authorization: Bearer <token>`.
 *
 * ┌─ DELIBERATE DOWNGRADE — see SECURITY.md ────────────────────────────────┐
 * │ This used to be an httpOnly cookie, which JavaScript cannot read and so │
 * │ an XSS cannot steal. It is now a bearer token the client keeps in       │
 * │ localStorage.                                                          │
 * │                                                                        │
 * │ Why: the app is served from *.vercel.app and this API from             │
 * │ *.onrender.com — different registrable domains, so the cookie was a    │
 * │ third-party cookie. Safari blocks those unconditionally, so admin      │
 * │ login appeared to succeed and every request after it 401'd. No code    │
 * │ change fixes that; only a shared parent domain does.                   │
 * │                                                                        │
 * │ Restore cookie auth once a custom domain exists. SECURITY.md has the   │
 * │ exact steps.                                                           │
 * └────────────────────────────────────────────────────────────────────────┘
 */
export function readToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) {
    const token = header.slice(7).trim();
    return token || null;
  }
  return null;
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = readToken(req);
  if (!token) throw new ApiError(401, 'Authentication required');
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    throw new ApiError(401, 'Invalid or expired token');
  }
}

/** Populate req.user when a valid token is present, but never require one. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = readToken(req);
  if (token) {
    try {
      req.user = verifyToken(token);
    } catch {
      /* ignore an invalid token: guest checkout must still work */
    }
  }
  next();
}

/**
 * Authorisation, separate from authentication.
 *
 * The role is read from the verified JWT payload only. Nothing here — or
 * anywhere else — trusts a `role` supplied in a request body or query.
 */
export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (req.user?.role !== 'admin') {
    throw new ApiError(403, 'Admin access required');
  }
  next();
}
