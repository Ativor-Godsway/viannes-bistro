import { Router } from 'express';
import {
  register,
  login,
  adminLogin,
  logout,
  me,
  registerSchema,
  loginSchema,
} from '../controllers/auth';
import { validateBody } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { loginLimiter } from '../middleware/rateLimit';

const router = Router();

// Credential endpoints are the brute-force surface, so they carry the strict
// limiter rather than the generous global one.
router.post('/register', loginLimiter, validateBody(registerSchema), register);
router.post('/login', loginLimiter, validateBody(loginSchema), login);
router.post('/admin-login', loginLimiter, validateBody(loginSchema), adminLogin);
router.post('/logout', logout);
router.get('/me', requireAuth, me);

export default router;
