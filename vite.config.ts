import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react(), {
    name: 'standalone-game-routes',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url || '/', 'http://localhost');
        const game = ['cookieclicker', 'hollowknight', 'vm'].find(name => url.pathname === '/' + name || url.pathname === '/' + name + '/');
        if (game && url.pathname === '/' + game) {
          res.writeHead(308, { Location: '/' + game + '/' + url.search });
          res.end();
          return;
        }
        if (game) req.url = '/' + game + '/index.html' + url.search;
        next();
      });
    },
  }],
  server: { proxy: { '/api/vm': { target: 'http://127.0.0.1:3001', ws: true }, '/decrypto': { target: 'http://127.0.0.1:3002', ws: true } } },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
