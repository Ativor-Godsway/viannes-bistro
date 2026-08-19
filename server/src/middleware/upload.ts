/**
 * Multipart image intake.
 *
 * Memory storage, not disk: the bytes go straight on to Cloudinary (see
 * config/cloudinary.ts) and never touch Render's ephemeral filesystem. The 5MB
 * cap keeps a buffered upload bounded, and the mimetype filter is a cheap first
 * pass — Cloudinary's `resource_type: 'image'` is the check that actually
 * inspects the content.
 */
import multer from 'multer';
import { ApiError } from './error';

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif|avif)$/.test(file.mimetype)) cb(null, true);
    else cb(new ApiError(400, 'Only JPEG, PNG, WebP, GIF or AVIF images are allowed'));
  },
});
