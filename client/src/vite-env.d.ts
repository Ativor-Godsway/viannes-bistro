/// <reference types="vite/client" />

/**
 * Client-side environment.
 *
 * Everything here is COMPILED INTO PUBLIC JAVASCRIPT. Vite inlines any variable
 * prefixed `VITE_` at build time, so it is readable by anyone who opens the
 * bundle. A secret must never appear here — no Paystack secret key, no JWT
 * secret, no database URI. The server holds those.
 */
interface ImportMetaEnv {
  /** Absolute API base URL in production, e.g. https://viannes-api.onrender.com/api */
  readonly VITE_API_URL?: string;
  /** Absolute Socket.IO origin in production, e.g. https://viannes-api.onrender.com */
  readonly VITE_SOCKET_URL?: string;
  /** Dev only: where the Vite proxy forwards /api. */
  readonly VITE_API_TARGET?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
