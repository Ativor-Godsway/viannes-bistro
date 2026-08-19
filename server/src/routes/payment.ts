import { Router, raw } from 'express';
import { verify, webhook } from '../controllers/payment';

/**
 * The webhook needs the RAW request body to check its HMAC, so this router is
 * mounted in index.ts BEFORE the global express.json(). Once express.json()
 * has consumed and re-parsed the stream, the original bytes are gone and the
 * signature can never be reproduced.
 */
export const paystackWebhookRouter = Router();
paystackWebhookRouter.post(
  '/paystack/webhook',
  raw({ type: '*/*' }),
  webhook
);

/** Everything else, on the normal JSON pipeline. */
const router = Router();
router.get('/paystack/verify/:reference', verify);
export default router;
