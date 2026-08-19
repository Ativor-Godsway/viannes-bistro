import { Request, Response } from 'express';
import { z } from 'zod';
import { User, hashPassword } from '../models/User';
import { signToken } from '../utils/jwt';
import { ApiError } from '../middleware/error';

export const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * The ONLY user shape that ever leaves this server.
 *
 * Explicitly constructed rather than spread, so a field added to the schema
 * later — a password hash, a reset token, an internal flag — cannot leak by
 * default. Never return a Mongoose document directly.
 */
function publicUser(u: { _id: unknown; name: string; email: string; role: string; phone?: string }) {
  return { id: u._id, name: u.name, email: u.email, role: u.role, phone: u.phone };
}

/**
 * Establishes the session.
 *
 * The JWT is returned in the RESPONSE BODY for the client to store and send
 * back as `Authorization: Bearer`. It used to be set as an httpOnly cookie,
 * which was safer — see the block comment in middleware/auth.ts and the
 * "Bearer tokens in localStorage" section of SECURITY.md for why that had to
 * change and how to put it back.
 */
function startSession(id: string, role: string) {
  return { token: signToken({ id, role: role as never }) };
}

export async function register(req: Request, res: Response): Promise<void> {
  const { name, email, password, phone } = req.body as z.infer<typeof registerSchema>;
  const existing = await User.findOne({ email });
  if (existing) throw new ApiError(409, 'Email already registered');

  const user = await User.create({
    name,
    email,
    phone,
    passwordHash: await hashPassword(password),
    role: 'customer',
  });
  const { token } = startSession(String(user._id), user.role);
  res.status(201).json({ user: publicUser(user), token });
}

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as z.infer<typeof loginSchema>;
  const user = await User.findOne({ email });
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, 'Invalid email or password');
  }
  if (!user.isActive) throw new ApiError(403, 'Account is disabled');

  const { token } = startSession(String(user._id), user.role);
  res.json({ user: publicUser(user), token });
}

export async function adminLogin(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as z.infer<typeof loginSchema>;
  const user = await User.findOne({ email });
  if (!user || !(await user.comparePassword(password))) {
    throw new ApiError(401, 'Invalid email or password');
  }
  if (user.role !== 'admin') throw new ApiError(403, 'Admin access required');
  if (!user.isActive) throw new ApiError(403, 'Account is disabled');

  const { token } = startSession(String(user._id), user.role);
  res.json({ user: publicUser(user), token });
}

/**
 * GET /api/auth/me — who the session cookie belongs to.
 *
 * Confirms the stored token is still valid and returns the current user, so
 * the client rehydrates from the server rather than trusting its cached copy.
 */
export async function me(req: Request, res: Response): Promise<void> {
  const user = await User.findById(req.user!.id);
  if (!user || !user.isActive) throw new ApiError(401, 'Session is no longer valid');
  res.json({ user: publicUser(user) });
}

/**
 * POST /api/auth/logout
 *
 * There is no server-side session to clear — the client discards its stored
 * token. Kept as an endpoint so the client has one call to make, and so a
 * future move back to cookies (or to a token denylist) has somewhere to live.
 */
export async function logout(_req: Request, res: Response): Promise<void> {
  res.json({ success: true });
}
