import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react(), {
    name: 'standalone-game-routes',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url || '/', 'http://localhost');
        const game = ['cookieclicker', 'hollowknight'].find(name => url.pathname === '/' + name || url.pathname === '/' + name + '/');
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
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
