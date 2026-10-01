import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { getVmConfig } from './remote-desktop/config.mjs';

export default defineConfig({
  plugins: [react(), {
    name: 'standalone-game-routes',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url || '/', 'http://localhost');
        if (url.pathname === '/api/vm/config') {
          res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
          res.end(JSON.stringify(getVmConfig({ ...loadEnv(server.config.mode, process.cwd(), 'VM_'), ...process.env })));
          return;
        }
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
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
