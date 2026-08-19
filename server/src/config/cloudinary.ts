/**
 * Cloudinary — where product photography actually lives.
 *
 * Uploads used to go to `src/uploads` on local disk. Two independent problems:
 * Render's filesystem is ephemeral, so every deploy silently deleted every
 * photo an admin had ever uploaded; and `tsc` does not copy that directory
 * into `dist/`, so the static mount pointed at nothing in a built app anyway.
 */
import { v2 as cloudinary } from 'cloudinary';
import { env, cloudinaryConfigured } from './env';

if (cloudinaryConfigured) {
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

export { cloudinary, cloudinaryConfigured };

export interface UploadedImage {
  url: string;
  publicId: string;
}

/**
 * Streams a buffer to Cloudinary and returns its permanent https URL.
 *
 * `resource_type: 'image'` makes Cloudinary reject anything that is not
 * actually an image, which is a real check on the file's content rather than
 * the client-supplied mimetype multer filters on.
 */
export function uploadImage(buffer: Buffer, filename: string): Promise<UploadedImage> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'viannes/menu',
        resource_type: 'image',
        public_id: `${Date.now()}-${filename.replace(/\.[^.]+$/, '').replace(/[^\w-]/g, '_')}`,
        overwrite: false,
        // Cap what we store: an admin phone photo is 12MP and nothing on the
        // storefront renders wider than 1600px.
        transformation: [{ width: 1600, height: 1600, crop: 'limit', quality: 'auto:good' }],
      },
      (err, result) => {
        if (err || !result) return reject(err ?? new Error('Cloudinary upload failed'));
        resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(buffer);
  });
}

/** Best-effort cleanup. A failure here must never fail the request. */
export async function destroyImage(publicId: string): Promise<void> {
  if (!cloudinaryConfigured || !publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.warn(`Could not delete Cloudinary asset ${publicId}:`, (err as Error).message);
  }
}
