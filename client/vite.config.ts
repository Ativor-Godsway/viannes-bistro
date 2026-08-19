import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// The backend the dev proxy forwards to. Override with VITE_API_TARGET in client/.env
// (e.g. VITE_API_TARGET=http://localhost:3000). Defaults to the server's default port.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.VITE_API_TARGET || 'http://localhost:3000';
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api': target,
        '/uploads': target,
        '/socket.io': { target, ws: true },
      },
    },
  };
});
