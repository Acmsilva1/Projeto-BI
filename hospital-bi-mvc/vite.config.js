import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    {
      name: 'dev-no-cache',
      configureServer(server) {
        server.middlewares.use((_, res, next) => {
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
          res.setHeader('Surrogate-Control', 'no-store');
          next();
        });
      },
    },
  ],
  server: {
    host: '127.0.0.1',
    port: 5174,
    strictPort: true,
  },
});
