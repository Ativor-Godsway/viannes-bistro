import { Router } from 'express';
import {
  createOrder,
  getOrder,
  listCustomerOrders,
  cancelOrder,
  createOrderSchema,
} from '../controllers/order';
import { validateBody } from '../middleware/validate';
// optionalAuth lives in middleware/auth now, so it reads the httpOnly session
// cookie like everything else instead of only an Authorization header.
import { requireAuth, optionalAuth } from '../middleware/auth';
import { orderLimiter } from '../middleware/rateLimit';

const router = Router();

router.post('/orders', orderLimiter, optionalAuth, validateBody(createOrderSchema), createOrder);
router.get('/customer/orders', requireAuth, listCustomerOrders);
router.get('/orders/:id', getOrder);
router.patch('/orders/:id/cancel', cancelOrder);

export default router;
