import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react(), {
    name: 'cookieclicker-route',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url || '/', 'http://localhost');
        if (url.pathname === '/cookieclicker') {
          res.writeHead(308, { Location: '/cookieclicker/' + url.search });
          res.end();
          return;
        }
        if (url.pathname === '/cookieclicker/') req.url = '/cookieclicker/index.html' + url.search;
        next();
      });
    },
  }],
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
