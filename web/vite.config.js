import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const vitePort = Number(process.env.VITE_PORT || 5180);
const apiPort = Number(process.env.PORT || 3020);

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  plugins: [
    react({
      fastRefresh: true,
    }),
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
    /** true = escuta em 0.0.0.0; acessível por localhost e 127.0.0.1 (evita proxy “só em um host”). */
    host: true,
    port: vitePort,
    strictPort: true,
    /** Hot reload imediato ao salvar arquivos (Fast Refresh do React). */
    hmr: {
      overlay: true,
    },
    /** No Windows/rede, o watcher nativo às vezes não dispara; polling garante atualização sem reiniciar o dev server. */
    watch: {
      usePolling: true,
      interval: 200,
    },
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${apiPort}`,
        changeOrigin: true,
        secure: false,
      },
    },
  },
  preview: {
    host: true,
    port: vitePort,
    strictPort: true,
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${apiPort}`,
        changeOrigin: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 700,
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/echarts') || id.includes('node_modules/zrender')) {
            return 'vendor-echarts';
          }
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-lucide';
          }
        },
      },
    },
  },
});
